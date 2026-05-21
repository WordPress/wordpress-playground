/**
 * Comlink worker endpoint for the `--experimental-posix-kernel`
 * browser mode. Parallel to `playground-worker-endpoint-blueprints-
 * v1.ts`, but the engine behind every method is the wasm-posix-kernel
 * (nginx + php-fpm in a Web Worker) instead of the in-process
 * `PHPRequestHandler` + `@php-wasm/web` runtime.
 *
 * Intentionally **does not** extend `PlaygroundWorkerEndpoint` /
 * `PHPWorker`. Those base classes are wired to PHP-WASM constructs
 * (`PHPRequestHandler`, `PHP`, `proxyFileSystem`, mount plumbing) the
 * kernel does not use. We stand up a fresh class that implements only
 * the API surface `boot-playground-remote.ts` (kernel-mode) consumes:
 * `boot / requestStreamed / onDownloadProgress / onMessage /
 * addEventListener / removeEventListener / absoluteUrl`.
 *
 * `isReady` and `isConnected` are NOT methods on this class — they are
 * intercepted by `exposeAPI`'s internal proxy and resolve against
 * promises wired to the `setApiReady` / `setApiError` callbacks
 * returned from `exposeAPI`. `boot()` calls those callbacks once the
 * kernel is up so the iframe-side `await kernelWorkerApi.isReady()`
 * unblocks.
 *
 * `requestStreamed()` round-trips a `PHPRequest` through the kernel's
 * MessagePort bridge into nginx, then wraps the bridge's
 * `HttpResponse` back into a `StreamedPHPResponse` so the existing
 * `streamToPort()` machinery in
 * `boot-playground-remote.ts:requestStreamed` keeps working without
 * changes.
 *
 * `boot()` orchestrates the full chain:
 *
 *   1. Download WordPress + SQLite zips via {@link prepareWordPressZips}
 *      (the {@link EmscriptenDownloadMonitor} feeds
 *      `onDownloadProgress`).
 *   2. Build an in-memory VFS image with {@link buildVfsImage}.
 *   3. Fetch `kernel.wasm` (resolved through the `@kernel-wasm` alias).
 *   4. Boot the kernel via {@link bootKernelWordPress}.
 *   5. Drive `wp-admin/install.php` once if WordPress isn't installed
 *      yet (port of the CLI's `ensureWordPressInstalled`).
 */
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { exposeAPI } from '@php-wasm/web';
import {
	PHPResponse,
	StreamedPHPResponse,
	type PHPRequest,
} from '@php-wasm/universal';
import { removeURLScope, setURLScope } from '@php-wasm/scopes';
import { logger } from '@php-wasm/logger';
import type { MessageListener } from '@php-wasm/universal';

import { bootKernelWordPress, type KernelBootResult } from './boot';
import { prepareWordPressZips } from './prepare-wordpress';
import { buildVfsImage } from './vfs-builder';
import { KernelSpawnAdapter } from './kernel-spawn-adapter';
import { KernelLimitedPHPApi } from './php-api';
import { CookieJar } from './cookie-jar';
import type { HttpRequest, HttpResponse } from './host-bridge';
import {
	LatestMinifiedWordPressVersion,
	MinifiedWordPressVersions,
	MinifiedWordPressVersionsList,
} from '@wp-playground/wordpress-builds';

/* @ts-ignore */
import { corsProxyUrl as defaultCorsProxyUrl } from 'virtual:cors-proxy-url';
import kernelWasmUrl from '@kernel-wasm?url';
import coreutilsUrl from '@kernel-binary/programs/wasm32/coreutils.wasm?url';
import phpWasmUrl from '@kernel-binary/programs/wasm32/php/php.wasm?url';

import { wordPressSiteUrl } from '../config';

// Tell the iframe-side boot we're alive even before Comlink is wired.
// Mirrors the classic worker's first line — `boot-playground-remote.ts`
// blocks on this message in `spawnPHPWorkerThread`.
self.postMessage('worker-script-started');

const downloadMonitor = new EmscriptenDownloadMonitor();

/**
 * Methods on `KernelLimitedPHPApi` that the endpoint forwards to over
 * Comlink. The list is derived once and used for both the pre-boot
 * stubs (which throw a clear error) and the post-boot rebinding (which
 * routes the call into the concrete `KernelLimitedPHPApi` instance).
 *
 * Mirrors the `LimitedPHPApi` type at
 * `packages/php-wasm/universal/src/lib/php-worker.ts:22-49`. If a
 * method gets added to that surface, it has to be added here too — the
 * TypeScript `keyof` guard makes the omission a compile error rather
 * than a runtime "Cannot read 'apply' of undefined" surprise.
 */
const LIMITED_PHP_API_METHODS = [
	'mkdir',
	'mkdirTree',
	'readFileAsText',
	'readFileAsBuffer',
	'writeFile',
	'unlink',
	'mv',
	'rmdir',
	'listFiles',
	'isDir',
	'fileExists',
	'chdir',
	'defineConstant',
	'run',
	'request',
] as const satisfies ReadonlyArray<keyof KernelLimitedPHPApi>;

type LimitedPHPApiMethod = (typeof LIMITED_PHP_API_METHODS)[number];

/**
 * Boot options accepted by the kernel-mode worker. We only consume a
 * subset of the classic `WorkerBootOptions` because the kernel-mode
 * handler doesn't take a PHP version, mounts, blueprints or
 * networking flags yet — the first cut stands up a default WordPress
 * install.
 */
export interface KernelWorkerBootOptions {
	scope: string;
	/** Forwarded to {@link resolveWordPressRelease}. Default `'latest'`. */
	wpVersion?: string;
	/** Pinned to `'v2.1.16'` in `prepareWordPressZips` if omitted. */
	sqliteDriverVersion?: 'trunk' | 'v2.1.16' | 'v3.0.0-rc.3-php52';
	/** Optional override for the build-time CORS proxy URL. */
	corsProxyUrl?: string;
	/**
	 * When `false`, the kernel comes up without downloading or extracting
	 * WordPress (PHP-only mode). `shouldInstallWordPress` gates the
	 * post-boot install drive independently. Both default to `true`.
	 */
	shouldBootWordPress?: boolean;
	shouldInstallWordPress?: boolean;
}

/**
 * Kernel-mode Comlink endpoint. Public surface matches what
 * `boot-playground-remote.ts` (kernel-mode) destructures from the
 * remote proxy. `isReady` / `isConnected` are intercepted by
 * `exposeAPI` and are NOT methods on this class — see the file
 * preamble for details.
 */
export class KernelPlaygroundWorkerEndpoint {
	/**
	 * Set during {@link boot} after `setURLScope(wordPressSiteUrl,
	 * scope)`. Read across the Comlink boundary by
	 * `boot-playground-remote.ts:setupPostMessageRelay` and
	 * `getOrigin(absoluteUrl)`.
	 */
	absoluteUrl: string = wordPressSiteUrl;
	/**
	 * Where the kernel-resident WordPress installation lives in the
	 * VFS. Read across the Comlink boundary by blueprint steps that
	 * derive paths from `playground.documentRoot` (e.g.
	 * `activate-plugin`, `install-asset`). Same value as the
	 * `VFS_DOCUMENT_ROOT` constant in `php-api.ts`.
	 */
	documentRoot = '/var/www/html';

	private booted = false;
	private kernel: KernelBootResult | undefined;
	private readonly downloadMonitor: EmscriptenDownloadMonitor;
	/**
	 * Cookie state shared between the SW-driven {@link requestStreamed}
	 * flow (iframe nav) and the blueprint-driven `playground.request(…)`
	 * flow (via {@link KernelLimitedPHPApi}). Necessary because
	 * Chrome's `Response` "response" headers guard silently drops
	 * `Set-Cookie` from synthetic SW responses, so we cannot delegate
	 * cookie persistence to the browser. See `cookie-jar.ts`.
	 */
	private readonly cookieJar = new CookieJar();

	constructor(monitor: EmscriptenDownloadMonitor) {
		this.downloadMonitor = monitor;
		this.installPreBootApiStubs();
	}

	/**
	 * Boot the kernel. Calling twice is a programming error — the v1
	 * worker raises the same way (see
	 * `playground-worker-endpoint-blueprints-v1.ts`). Resolves the
	 * `setApiReady` callback so `kernelWorkerApi.isReady()` unblocks
	 * on the iframe side.
	 */
	async boot(options: KernelWorkerBootOptions): Promise<void> {
		if (this.booted) {
			throw new Error('KernelPlaygroundWorkerEndpoint: already booted');
		}
		this.booted = true;
		try {
			await this.doBoot(options);
			setApiReady();
		} catch (e) {
			setApiError(e as Error);
			throw e;
		}
	}

	/**
	 * Forward a `PHPRequest` to the kernel-resident nginx and wrap the
	 * bridge's buffered `HttpResponse` as a streaming PHP response.
	 *
	 * Scope stripping: the service worker rewrites every URL to
	 * `/scope:<id>/…`; kernel-mode nginx doesn't know about scopes, so
	 * we strip the prefix at the bridge boundary before forwarding.
	 */
	async requestStreamed(request: PHPRequest): Promise<StreamedPHPResponse> {
		if (!this.kernel) {
			throw new Error(
				'KernelPlaygroundWorkerEndpoint.requestStreamed: kernel is not booted.'
			);
		}

		// Two URL transforms before the request hits the bridge:
		//   1. Strip the scope (`/scope:xxx/…`) so kernel-resident
		//      nginx, which knows nothing about scopes, sees the
		//      naked path.
		//   2. Reduce to **origin-form** (path + query + fragment).
		//      `buildRawHttpRequest` in
		//      `wasm-posix-kernel/examples/browser/lib/
		//      kernel-worker-entry.ts:1130` writes the URL verbatim
		//      onto the request line: `GET <url> HTTP/1.1`. Passing
		//      a full `http://127.0.0.1:5400/...` (absolute-URI form)
		//      sends nginx into a non-responsive state — `req#9`
		//      logged START but never DONE, and the service worker
		//      timed out at 30s. The `install.php` POST worked
		//      precisely because `ensureWordPressInstalled` already
		//      passes an origin-form path.
		const unscopedUrl = removeURLScope(
			new URL(request.url, this.absoluteUrl)
		);
		const originForm = `${unscopedUrl.pathname}${unscopedUrl.search}${unscopedUrl.hash}`;

		// Tell WP what URL it's actually being served at. `absoluteUrl`
		// is the scoped origin (`http://127.0.0.1:5400/scope:xxx`); the
		// wp-config template reads this header into `WP_HOME` and
		// `WP_SITEURL` so every absolute link/asset WP renders points
		// back through the service-worker scope. Without it, WP_HOME
		// falls back to `http://${HTTP_HOST}/app`, and the iframe loads
		// HTML whose <link>/<script> URLs point at a port nothing is
		// listening on — Chrome reports "127.0.0.1 refused to
		// connect."
		const headers = flattenHeaders(request.headers);
		headers['x-playground-absolute-url'] = this.absoluteUrl.replace(
			/\/+$/,
			''
		);

		// Inject the jar's current state as the `Cookie:` header. The
		// browser never sees the kernel's `Set-Cookie` (synthetic
		// responses from a SW drop it), so the jar is the only place
		// session cookies are tracked between iframe nav requests.
		const cookieHeader = this.cookieJar.serialize();
		if (cookieHeader && !('cookie' in headers)) {
			headers['cookie'] = cookieHeader;
		}

		const bridgeRequest: HttpRequest = {
			method: request.method ?? 'GET',
			url: originForm,
			headers,
			body: encodeRequestBody(request.body),
		};

		const bridgeResponse: HttpResponse =
			await this.kernel.sendRequest(bridgeRequest);

		// Ingest any `Set-Cookie` PHP emitted into the jar, then drop
		// `set-cookie` from the response we hand the SW. Chrome's
		// response-guard would discard it anyway; stripping it here
		// makes the data flow honest and avoids any code path that
		// might inadvertently try to use the (lost) header.
		this.cookieJar.ingestAll(
			bridgeResponse.headers['set-cookie'] ??
				bridgeResponse.headers['Set-Cookie']
		);
		delete bridgeResponse.headers['set-cookie'];
		delete bridgeResponse.headers['Set-Cookie'];

		// The kernel-mode parent document (`remote.html` served by Vite
		// at port 5400) is configured with
		// `Cross-Origin-Embedder-Policy: require-corp` (see
		// `packages/playground/remote/vite.posix-kernel.config.ts:228`)
		// to make the kernel worker's `SharedArrayBuffer` allocation
		// legal. The COEP spec requires every embedded iframe response
		// to also carry COEP — otherwise Chrome refuses to render the
		// frame and surfaces it as "127.0.0.1 refused to connect"
		// without any explicit network error. WordPress only emits COEP
		// on wp-admin pages (via `wp_set_up_cross_origin_isolation`),
		// not on the front end, so the kernel bridge has to inject it.
		// The service worker's `applyCrossOriginIsolationHeaders`
		// (`service-worker.ts:673`) will rewrite this to
		// `Document-Isolation-Policy` on Chrome 137+, keeping the
		// embedder side flexible. CORP `same-origin` is added so
		// sub-resources from this scope can be embedded into the
		// COEP'd document without triggering the no-CORP failure
		// (everything is same-origin in the dev server, but the
		// header is required by spec regardless).
		if (!('cross-origin-embedder-policy' in bridgeResponse.headers)) {
			bridgeResponse.headers['cross-origin-embedder-policy'] =
				'require-corp';
		}
		if (!('cross-origin-opener-policy' in bridgeResponse.headers)) {
			bridgeResponse.headers['cross-origin-opener-policy'] =
				'same-origin';
		}
		if (!('cross-origin-resource-policy' in bridgeResponse.headers)) {
			bridgeResponse.headers['cross-origin-resource-policy'] =
				'same-origin';
		}

		const phpResponse = new PHPResponse(
			bridgeResponse.status,
			arrayifyHeaders(bridgeResponse.headers),
			bridgeResponse.body
		);
		return StreamedPHPResponse.fromPHPResponse(phpResponse);
	}

	/**
	 * Pipe `EmscriptenDownloadMonitor` 'progress' events into the
	 * Comlink-proxied callback. Matches the base `PHPWorker.
	 * onDownloadProgress` shape used by the classic boot path so the
	 * website-side handler is unchanged.
	 */
	async onDownloadProgress(
		callback: (progress: CustomEvent<ProgressEvent>) => void
	): Promise<void> {
		this.downloadMonitor.addEventListener('progress', callback as any);
	}

	/**
	 * No-op for the first cut. The classic worker uses this to deliver
	 * blueprint messages back to the host; we wire the hook now so the
	 * iframe-side boot can call it unconditionally without crashing.
	 * Returns an unsubscribe function to match the classic shape (see
	 * `PlaygroundWorkerEndpoint.onBlueprintMessage`).
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async onMessage(_callback: MessageListener): Promise<() => Promise<void>> {
		return async () => {
			/* no-op unsubscribe */
		};
	}

	/**
	 * Match the classic worker's event-subscription shape so the
	 * website's hookups don't blow up. Kernel mode emits no events
	 * yet — future work will route stdout/stderr / FS events through
	 * here.
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async addEventListener(_event: string, _listener: any): Promise<void> {
		/* no-op for the first cut */
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async removeEventListener(_event: string, _listener: any): Promise<void> {
		/* no-op for the first cut */
	}

	async getMinifiedWordPressVersions() {
		return {
			all: MinifiedWordPressVersions,
			latest: LatestMinifiedWordPressVersion,
		};
	}

	/**
	 * No-op stub for `BlueprintsV1Handler`'s prefetch step
	 * (`packages/playground/client/src/blueprints-v1-handler.ts:143`).
	 * It calls `playground.prefetchUpdateChecks()` unconditionally once
	 * WordPress is installed, which in the classic path warms a few
	 * update-checks endpoints. The kernel-mode handler doesn't model
	 * this, but the method has to *exist* on the Comlink endpoint so
	 * the v1 handler doesn't blow up with "Cannot read 'apply' of
	 * undefined" in `comlink-sync.ts:214`.
	 *
	 * Deliberately NOT a `LimitedPHPApi` method, so this stays off
	 * `LIMITED_PHP_API_METHODS` — it's a `PlaygroundClient` concept.
	 */
	async prefetchUpdateChecks(): Promise<void> {
		/* no-op for the first cut */
	}

	/**
	 * Convert a server-relative path (`/wp-admin/`) into the absolute,
	 * scoped URL the iframe should load (`http://host:5400/scope:xx/
	 * wp-admin/`). The classic worker inherits this from
	 * `PHPRequestHandler.pathToInternalUrl`
	 * (`packages/php-wasm/universal/src/lib/php-request-handler.ts:
	 * 327`); kernel mode has no `PHPRequestHandler`, so we re-implement
	 * the same one-liner against `this.absoluteUrl`.
	 *
	 * Required by `boot-playground-remote.ts:goTo`
	 * (`packages/playground/remote/src/lib/posix-kernel/
	 * boot-playground-remote.ts:134`) and by the V1 blueprint runner's
	 * landing-page redirect in
	 * `packages/playground/blueprints/src/lib/v1/compile.ts:459`. The
	 * V1 runner wraps the call in a try/catch that **swallows** the
	 * throw — without this method the iframe silently never
	 * navigates and stays blank.
	 */
	async pathToInternalUrl(path: string): Promise<string> {
		const normalized = path.startsWith('/') ? path : `/${path}`;
		// `this.absoluteUrl` already carries any scope segment from
		// `setURLScope` in `doBoot`. Strip a trailing slash so we
		// don't double up on `/` when concatenating.
		const base = this.absoluteUrl.replace(/\/+$/, '');
		return `${base}${normalized}`;
	}

	/**
	 * Inverse of {@link pathToInternalUrl}: strip the scoped URL prefix
	 * and return the server-relative path so the website can update its
	 * URL bar / navigation listeners. Polled from
	 * `boot-playground-remote.ts:onNavigation` and `getCurrentURL`.
	 *
	 * Mirrors `PHPRequestHandler.internalUrlToPath`
	 * (`packages/php-wasm/universal/src/lib/php-request-handler.ts:
	 * 341`).
	 */
	async internalUrlToPath(internalUrl: string): Promise<string> {
		const baseUrl = new URL(this.absoluteUrl);
		// Match the request-handler's normalization: strip trailing
		// slashes from the base pathname before checking prefix
		// containment (`php-request-handler.ts:305`).
		const basePath = baseUrl.pathname.replace(/\/+$/, '');
		const url = new URL(internalUrl, 'https://playground.internal');
		if (basePath && url.pathname.startsWith(basePath)) {
			url.pathname = url.pathname.slice(basePath.length);
		}
		return `${url.pathname}${url.search}${url.hash}`;
	}

	private async doBoot(options: KernelWorkerBootOptions): Promise<void> {
		this.absoluteUrl = setURLScope(
			wordPressSiteUrl,
			options.scope
		).toString();

		const corsProxyUrl = options.corsProxyUrl ?? defaultCorsProxyUrl;
		const bootWordPress = options.shouldBootWordPress !== false;
		const installWordPress = options.shouldInstallWordPress !== false;

		let wpZipBytes: Uint8Array | undefined;
		let sqliteZipBytes: Uint8Array | undefined;
		if (bootWordPress) {
			logger.debug(
				`[posix-kernel] preparing WordPress zips (scope=${options.scope})`
			);
			// `'nightly'` aliases to `'trunk'`; anything else not in the
			// minified bundle (e.g. `'latest'`) falls back to the bundled
			// `LatestMinifiedWordPressVersion`.
			const requestedWpVersion =
				(options.wpVersion === 'nightly'
					? 'trunk'
					: options.wpVersion) ?? LatestMinifiedWordPressVersion;
			const wpVersionQuery = MinifiedWordPressVersionsList.includes(
				requestedWpVersion
			)
				? requestedWpVersion
				: LatestMinifiedWordPressVersion;
			const zips = await prepareWordPressZips({
				wpVersionQuery,
				sqliteVersion: options.sqliteDriverVersion,
				corsProxyUrl,
				monitor: this.downloadMonitor,
				onStatus: (m) => logger.log(`[posix-kernel] ${m}`),
			});
			wpZipBytes = zips.wpZipBytes;
			sqliteZipBytes = zips.sqliteZipBytes;
			logger.debug(
				`[posix-kernel] WordPress ${zips.wpVersion} downloaded`
			);
		} else {
			logger.debug(
				'[posix-kernel] PHP-only mode (shouldBootWordPress=false); ' +
					'skipping WordPress download'
			);
		}

		logger.debug('[posix-kernel] building VFS image');
		const vfsImage = await buildVfsImage({
			wpZipBytes,
			sqliteZipBytes,
			onStatus: (m) => logger.log(`[posix-kernel] ${m}`),
		});

		// `kernel.wasm` then `coreutils.wasm` + `php.wasm` in parallel.
		// Sequential first (we need to start the kernel before spawning
		// anything); the two spawn binaries share the dev-server cache
		// with `vfs-builder.ts`'s `?url` imports, and `php.wasm` is
		// ~18 MiB — running them in parallel shaves a second off boot.
		logger.debug('[posix-kernel] fetching kernel.wasm');
		const kernelWasm = await fetchArrayBuffer(kernelWasmUrl, 'kernel.wasm');

		logger.debug('[posix-kernel] booting kernel');
		this.kernel = await bootKernelWordPress({
			kernelWasm,
			vfsImage,
		});

		logger.debug('[posix-kernel] fetching spawn binaries');
		const [coreutilsBytes, phpWasmBytes] = await Promise.all([
			fetchArrayBuffer(coreutilsUrl, 'coreutils.wasm'),
			fetchArrayBuffer(phpWasmUrl, 'php.wasm'),
		]);

		const adapter = new KernelSpawnAdapter({
			kernel: this.kernel.kernel,
			coreutilsBytes,
			phpWasmBytes,
			setCapture: this.kernel.setCapture,
		});
		const api = new KernelLimitedPHPApi({
			absoluteUrl: this.absoluteUrl,
			adapter,
			sendRequest: this.kernel.sendRequest,
			cookieJar: this.cookieJar,
		});
		this.bindApiMethods(api);

		if (installWordPress) {
			logger.debug(
				'[posix-kernel] driving WordPress installer if needed'
			);
			await ensureWordPressInstalled(
				this.kernel.sendRequest,
				this.absoluteUrl
			);
			await defaultToPrettyPermalinks(api);
		} else {
			logger.debug(
				'[posix-kernel] skipping WordPress install drive ' +
					'(shouldInstallWordPress=false)'
			);
		}
		logger.debug('[posix-kernel] boot complete');
	}

	/**
	 * Pre-boot placeholders for the {@link LIMITED_PHP_API_METHODS}
	 * surface. Without these, a consumer that calls (say)
	 * `playground.mkdir(p)` before awaiting `isReady()` hits Comlink's
	 * generic "Cannot read 'apply' of undefined" — a recurring
	 * diagnostic that costs time. Throwing a named error from the stub
	 * makes the misuse obvious.
	 *
	 * Overwritten by {@link bindApiMethods} once the kernel + api are
	 * up. Comlink resolves method names at message-receive time, so the
	 * iframe sees the new methods immediately.
	 */
	private installPreBootApiStubs(): void {
		for (const name of LIMITED_PHP_API_METHODS) {
			(this as Record<LimitedPHPApiMethod, unknown>)[name] =
				async (): Promise<never> => {
					throw new Error(
						`KernelPlaygroundWorkerEndpoint.${name}: called ` +
							'before boot completed. Await `isReady()` on the ' +
							'consumer side before invoking LimitedPHPApi methods.'
					);
				};
		}
	}

	/**
	 * Replace the pre-boot stubs with method references that delegate
	 * to the live {@link KernelLimitedPHPApi}. `bind(api)` is required
	 * because the api methods read instance state (`this.adapter`,
	 * `this.constants`, `this.cookieJar`) — without it, Comlink would
	 * invoke them with `this === endpoint` and they'd see `undefined`.
	 */
	private bindApiMethods(api: KernelLimitedPHPApi): void {
		for (const name of LIMITED_PHP_API_METHODS) {
			const method = api[name] as (...args: unknown[]) => unknown;
			(this as Record<LimitedPHPApiMethod, unknown>)[name] =
				method.bind(api);
		}
	}
}

async function fetchArrayBuffer(
	url: string,
	label: string
): Promise<ArrayBuffer> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to download ${label}: HTTP ${response.status} from ${url}`
		);
	}
	return response.arrayBuffer();
}

/**
 * Idempotent WordPress install probe. Ported from the CLI's
 * `ensureWordPressInstalled` (see
 * `packages/playground/cli/src/posix-kernel/prepare-wordpress.ts`) but
 * implemented against the kernel's MessagePort bridge instead of
 * `KernelLimitedPHPApi.request()`. The flow is identical:
 *
 *   1. GET `/`. If the response is a 302 to `install.php`, install.
 *   2. POST the install form to `/wp-admin/install.php?step=2`.
 *   3. Confirm the success marker appears in the response body.
 *
 * Implementing this here (rather than after `kernelWorkerApi.boot()`
 * returns on the iframe side) keeps WordPress install latency inside
 * the `boot()` promise the iframe is already awaiting.
 */
async function ensureWordPressInstalled(
	send: (req: HttpRequest) => Promise<HttpResponse>,
	absoluteUrl: string
): Promise<void> {
	// Same header `requestStreamed` injects on every browser-side
	// request. Passing it on the install POST means WordPress records
	// the scoped site URL in `wp_options.home` / `wp_options.siteurl`
	// during `wp_install()`, so DB values stay aligned with the WP_HOME
	// constant the wp-config template defines on subsequent requests.
	// Stripping the trailing slash matches the runtime contract — the
	// install POST and the wp-config branch must agree byte-for-byte.
	const scopedSiteUrl = absoluteUrl.replace(/\/+$/, '');
	const installHeaders = {
		'x-playground-absolute-url': scopedSiteUrl,
	};

	const probe = await send({
		method: 'GET',
		url: '/',
		headers: installHeaders,
		body: null,
	});
	const location =
		probe.headers['location'] ?? probe.headers['Location'] ?? '';
	const installRequired =
		probe.status === 302 && location.includes('install.php');
	logger.log(
		`[posix-kernel] install probe: status=${probe.status} ` +
			`location=${JSON.stringify(location)} ` +
			`bodyLen=${probe.body?.byteLength ?? 0} ` +
			`installRequired=${installRequired}`
	);
	if (!installRequired) {
		return;
	}

	const formBody = new URLSearchParams({
		weblog_title: 'My WordPress Website',
		user_name: 'admin',
		admin_password: 'password',
		admin_password2: 'password',
		// `pw_weak=1` is required when the password fails WP's weak-
		// password heuristic — without it the installer re-renders the
		// form instead of installing.
		pw_weak: '1',
		admin_email: 'admin@example.com',
		blog_public: '1',
		Submit: 'Install WordPress',
	}).toString();

	const installResponse = await send({
		method: 'POST',
		url: '/wp-admin/install.php?step=2',
		headers: {
			...installHeaders,
			'content-type': 'application/x-www-form-urlencoded',
		},
		body: new TextEncoder().encode(formBody),
	});
	if (installResponse.status !== 200) {
		throw new Error(
			`WordPress install request failed: HTTP ${installResponse.status}`
		);
	}
	const html = new TextDecoder().decode(installResponse.body);
	if (
		!html.includes('Success') &&
		!html.includes('WordPress has been installed')
	) {
		throw new Error(
			`WordPress installer did not report success: ${html.slice(0, 1000)}`
		);
	}
}

/**
 * Set `permalink_structure` to the date-based pretty pattern. Required
 * by `wp_redirect_xml_sitemap` (WP 6.7+) and any rewrite-rule-driven
 * URL (pretty posts, /feed/, archives).
 */
async function defaultToPrettyPermalinks(
	api: KernelLimitedPHPApi
): Promise<void> {
	const result = await api.run({
		code: `<?php
			ob_start();
			require '/var/www/html/wp-load.php';
			$nice = '/%year%/%monthnum%/%day%/%postname%/';
			update_option('permalink_structure', $nice);
			ob_end_clean();
			echo get_option('permalink_structure') === $nice ? '1' : '0';
		`,
	});
	if (result.text !== '1') {
		logger.warn(
			`[posix-kernel] Failed to default to pretty permalinks ` +
				`after WP install (stdout=${JSON.stringify(result.text)}, ` +
				`stderr=${JSON.stringify(result.errors)}).`
		);
	}
}

function flattenHeaders(
	headers: Record<string, string> | undefined
): Record<string, string> {
	if (!headers) {
		return {};
	}
	const flat: Record<string, string> = {};
	for (const [k, v] of Object.entries(headers)) {
		flat[k.toLowerCase()] = v;
	}
	return flat;
}

/**
 * The bridge speaks `Record<string,string>`; `PHPResponse` expects
 * `Record<string,string[]>` so values are uniformly indexable. Wrap
 * each header value in a single-element array.
 */
function arrayifyHeaders(
	headers: Record<string, string>
): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const [k, v] of Object.entries(headers)) {
		out[k.toLowerCase()] = [v];
	}
	return out;
}

/**
 * Coerce `PHPRequest.body` into the `Uint8Array | null` shape the
 * bridge expects. We accept the three forms the type defines:
 *
 *   - `undefined`  → no body
 *   - `string`     → UTF-8 encoded bytes
 *   - `Uint8Array` → passed through
 *
 * The `Record<string, string | Uint8Array | File>` form (multipart
 * upload from blueprints v1) isn't reachable from the first-cut boot
 * path, so we throw rather than silently drop it.
 */
function encodeRequestBody(body: PHPRequest['body']): Uint8Array | null {
	if (body === undefined) {
		return null;
	}
	if (typeof body === 'string') {
		return new TextEncoder().encode(body);
	}
	if (body instanceof Uint8Array) {
		return body;
	}
	throw new Error(
		'KernelPlaygroundWorkerEndpoint.requestStreamed: multipart ' +
			'`body` objects are not supported in the kernel-mode worker yet.'
	);
}

/**
 * Sanity guard against the worker entrypoint being imported as a
 * module rather than spawned as a `?worker&url` URL. The classic v1
 * worker uses the same defensive check (see
 * `playground-worker-endpoint-blueprints-v1.ts`).
 */
const workerGlobal = self as unknown as {
	__kernelPlaygroundWorkerEndpoint?: boolean;
};
if (workerGlobal.__kernelPlaygroundWorkerEndpoint) {
	throw new Error(
		'The kernel-mode Playground worker tried to expose its Comlink ' +
			'endpoint more than once in the same worker global. This means ' +
			'`playground-worker-endpoint.ts` was imported as a dependency. ' +
			'Worker entrypoints must only be spawned via `?worker&url`.'
	);
}
workerGlobal.__kernelPlaygroundWorkerEndpoint = true;

const endpoint = new KernelPlaygroundWorkerEndpoint(downloadMonitor);
const [setApiReady, setApiError] = exposeAPI(endpoint);
