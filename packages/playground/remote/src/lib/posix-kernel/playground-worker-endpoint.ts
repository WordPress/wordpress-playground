/**
 * Comlink worker endpoint for the `--experimental-posix-kernel`
 * browser mode. Parallel to `playground-worker-endpoint-blueprints-
 * v1.ts`, but the engine behind every method is the kandelo
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
import type { SyncProgressCallback } from '@php-wasm/web';
import {
	PHPResponse,
	StreamedPHPResponse,
	type PHPRequest,
} from '@php-wasm/universal';
import { removeURLScope, setURLScope } from '@php-wasm/scopes';
import { logger } from '@php-wasm/logger';
import type { MessageListener } from '@php-wasm/universal';
import { directoryHandleFromMountDevice } from '@wp-playground/storage';
import type { WordPressInstallMode } from '@wp-playground/wordpress';

import { bootKernelWordPress, type KernelBootResult } from './boot';
import { downloadWpCliPhar, prepareWordPressZips } from './prepare-wordpress';
import { buildVfsImage } from './vfs-builder';
import { KernelSpawnAdapter } from './kernel-spawn-adapter';
import { KernelLimitedPHPApi } from './php-api';
import { KernelTerminalManager, type TerminalSize } from './terminal';
import { CookieJar } from './cookie-jar';
import type { HttpRequest, HttpResponse } from './host-bridge';
import type { MountDescriptor } from '../playground-worker-endpoint';
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
	'cp',
	'rmdir',
	'listFiles',
	'isDir',
	'fileExists',
	'chdir',
	'defineConstant',
	'run',
	'runStream',
	'request',
] as const satisfies ReadonlyArray<keyof KernelLimitedPHPApi>;

type LimitedPHPApiMethod = (typeof LIMITED_PHP_API_METHODS)[number];

/**
 * Boot options accepted by the kernel-mode worker. We only consume a
 * subset of the classic `WorkerBootOptions` because the kernel-mode
 * handler doesn't take a PHP version, mounts or blueprints yet — the
 * first cut stands up a default WordPress install.
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
	 * How to handle WordPress installation, mirroring the classic
	 * worker's `WorkerBootOptions.wordpressInstallMode` (see
	 * `../playground-worker-endpoint-blueprints.ts`). The website client
	 * resolves `preferredVersions.wp: false` to
	 * `'do-not-attempt-installing'` (PHP-only mode), which makes the
	 * kernel skip both the WordPress download/extraction and the
	 * post-boot install drive. Defaults to `'download-and-install'`.
	 */
	wordpressInstallMode?: WordPressInstallMode;
	/** @deprecated Use `wordpressInstallMode` instead. */
	shouldInstallWordPress?: boolean;
	/**
	 * Mirror of classic mode's `WorkerBootOptions.withNetworking` —
	 * forwarded by `playground.boot({...withNetworking})` from the
	 * iframe client. When `false`, php-fpm's pool config disables
	 * `allow_url_fopen` and disables `curl_exec` / `curl_multi_exec`
	 * (the same surface classic mode flips off via php.ini). The
	 * kernel worker's TLS-MITM backend always routes outbound traffic
	 * through the Vite CORS proxy in dev, so the only gate that
	 * actually blocks a request is `allow_url_fopen=0` inside PHP itself.
	 * Default `true`.
	 */
	withNetworking?: boolean;
	/**
	 * PHP extensions the blueprint opted into, forwarded verbatim by
	 * `playground.boot({ extensions })` from the iframe client (mapped
	 * from `features.intl` etc. in `blueprints-v1-handler.ts`). The kernel
	 * only honors `'intl'` today: when present, {@link buildVfsImage} stages
	 * `intl.so` and php-fpm loads it. Any other entry is currently ignored.
	 * Absent/empty → the default (intl-off) config, which lets the boot use
	 * the shared prebuilt snapshot.
	 */
	extensions?: string[];
	/**
	 * Mounts to apply during boot. Only `opfs-to-memfs` mounts are
	 * processed here; `memfs-to-opfs` mounts are initiated later by
	 * the host via {@link mountOpfs}.
	 */
	mounts?: Array<MountDescriptor>;
	/**
	 * URL of a pre-installed SQLite database captured from an earlier
	 * boot (the bytes of `wp-content/database/wordpress.db`). When set,
	 * the fetched bytes are seeded into the VFS image so the site boots
	 * already-installed and the post-boot install drive short-circuits.
	 * Test-only: the e2e suite pre-builds one snapshot in globalSetup and
	 * points every test at it so each boot skips the CPU-heavy installer.
	 */
	preinstalledDatabaseUrl?: string;
	/**
	 * URL of a fully prebuilt VFS image captured from an earlier boot (WP
	 * core + static assets + SQLite drop-in + configs + the seeded installed
	 * DB). A strict superset of {@link preinstalledDatabaseUrl}: when set and
	 * reachable, the fetched image is booted verbatim and the worker skips
	 * the zip download AND {@link buildVfsImage} entirely — dropping the
	 * ~27 s WP-core/static extraction + ~5 s serialization off every boot.
	 * Non-fatal: a missing/404 image falls back to the full build (which
	 * still honors `preinstalledDatabaseUrl`). Test-only, same lifecycle as
	 * the DB snapshot: globalSetup builds one image, every test boots it.
	 */
	prebuiltVfsImageUrl?: string;
}

/**
 * The zip/config inputs {@link buildVfsImage} needs, minus the per-capture
 * `preinstalledDatabase` and `onStatus`. Stashed on {@link boot} so
 * {@link KernelPlaygroundWorkerEndpoint.captureVfsImage} can rebuild the
 * image with the freshly-installed DB seeded in. Absent when the worker
 * booted from a prebuilt image (nothing to rebuild from).
 */
interface VfsBuildInputs {
	wpZipBytes?: Uint8Array;
	sqliteZipBytes?: Uint8Array;
	wpZipStripLeadingDir?: string;
	wpStaticZipBytes?: Uint8Array;
	wpCliPharBytes: Uint8Array;
	withNetworking: boolean;
	withIntl: boolean;
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
	/**
	 * Live {@link KernelLimitedPHPApi} bound after boot. Held as a field
	 * (in addition to the methods Comlink-bound onto `this` via
	 * {@link bindApiMethods}) so {@link mountOpfs} can drive its own VFS
	 * walk without going through the Comlink-exposed surface.
	 */
	private api: KernelLimitedPHPApi | undefined;
	/**
	 * Mountpoints that have already received a one-shot OPFS snapshot.
	 * Kernel-mode `mountOpfs` is not a continuous mirror — it walks the
	 * VFS once and writes the bytes out — so the only state we track is
	 * "this mountpoint already exists." `unmountOpfs` drops the entry so
	 * a later mount with the same name succeeds.
	 */
	private readonly opfsMounts = new Set<string>();
	/**
	 * PTY shell sessions for the website's terminal pane. Created after
	 * boot alongside the spawn adapter; deliberately independent of it —
	 * PTY output routes per-pid, so a live shell never touches the
	 * adapter's singleton capture slot. See `terminal.ts`.
	 */
	private terminals: KernelTerminalManager | undefined;
	/**
	 * The {@link buildVfsImage} inputs captured on the full-build boot path,
	 * kept so {@link captureVfsImage} can rebuild the image with the
	 * freshly-installed DB seeded in. Undefined when the worker booted from a
	 * prebuilt image — there is nothing to rebuild in that case.
	 */
	private vfsBuildInputs: VfsBuildInputs | undefined;

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
	 * Read the installed SQLite database out of the running kernel so a
	 * caller can persist it and feed it back as
	 * {@link KernelWorkerBootOptions.preinstalledDatabaseUrl} on later boots.
	 * Must be called after boot has completed. Used by the e2e globalSetup.
	 */
	async captureInstalledDatabase(): Promise<Uint8Array> {
		if (!this.api) {
			throw new Error(
				'KernelPlaygroundWorkerEndpoint.captureInstalledDatabase: ' +
					'kernel is not booted.'
			);
		}
		return await this.api.readFileAsBuffer(
			'/var/www/html/wp-content/database/wordpress.db'
		);
	}

	/**
	 * Rebuild the full VFS image with the currently-installed DB seeded in,
	 * so a caller can persist it and feed it back as
	 * {@link KernelWorkerBootOptions.prebuiltVfsImageUrl} on later boots
	 * (which then skip the zip download + {@link buildVfsImage} entirely).
	 * Rebuilds from the stashed boot inputs rather than re-serializing the
	 * live kernel VFS — the kernel exposes no image-export hook, and the WP
	 * files are byte-identical to boot; only the DB changed during install,
	 * and that is captured via {@link captureInstalledDatabase}.
	 *
	 * Must be called after a full-build boot (the e2e globalSetup's, which
	 * never carries a prebuilt image). Throws if the worker itself booted
	 * from a prebuilt image, since there is nothing to rebuild from.
	 */
	async captureVfsImage(): Promise<Uint8Array> {
		if (!this.api) {
			throw new Error(
				'KernelPlaygroundWorkerEndpoint.captureVfsImage: ' +
					'kernel is not booted.'
			);
		}
		if (!this.vfsBuildInputs) {
			throw new Error(
				'KernelPlaygroundWorkerEndpoint.captureVfsImage: booted from ' +
					'a prebuilt image; no build inputs to rebuild from.'
			);
		}
		const preinstalledDatabase = await this.captureInstalledDatabase();
		// The shared snapshot must carry the DEFAULT runtime config so the
		// `doBoot` snapshot gate can serve it to any default-config test:
		// networking ON (curl enabled) and intl OFF. Install itself still
		// runs networking-off in globalSetup (WP shouldn't phone home); we
		// only flip the baked runtime config at capture time. Tests that
		// need networking-off or intl-on fall through to a cold build.
		return await buildVfsImage({
			...this.vfsBuildInputs,
			withNetworking: true,
			withIntl: false,
			preinstalledDatabase,
			onStatus: (m) => logger.log(`[posix-kernel] ${m}`),
		});
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
		// Iframe navs bypass KernelLimitedPHPApi.request, so unawaited
		// defineConstant writes (login.ts:43) can still be mid-flight
		// when the auto-login mu-plugin reads the store.
		await this.api?.flushPendingDefines();

		// Two URL transforms before the request hits the bridge:
		//   1. Strip the scope (`/scope:xxx/…`) so kernel-resident
		//      nginx, which knows nothing about scopes, sees the
		//      naked path.
		//   2. Reduce to **origin-form** (path + query + fragment).
		//      `buildRawHttpRequest` in
		//      `kandelo/examples/browser/lib/
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

	/**
	 * One-shot sync between the kernel VFS subtree at `options.mountpoint`
	 * and the OPFS directory `options.device`. `memfs-to-opfs` snapshots
	 * VFS → OPFS (save); `opfs-to-memfs` overlays OPFS → VFS (restore).
	 * No continuous journaling — the kernel owns the VFS and exposes
	 * no MEMFS hooks; saves are re-invoked whenever the user clicks
	 * "Save site locally".
	 */
	async mountOpfs(
		options: MountDescriptor,
		onProgress?: SyncProgressCallback
	): Promise<void> {
		if (!this.api) {
			throw new Error(
				'KernelPlaygroundWorkerEndpoint.mountOpfs: called before ' +
					'kernel boot completed. Await `isReady()` first.'
			);
		}
		if (this.opfsMounts.has(options.mountpoint)) {
			throw new Error(
				`OPFS mount already exists at "${options.mountpoint}".`
			);
		}

		const opfsRoot = await directoryHandleFromMountDevice(options.device);
		if (options.initialSyncDirection === 'memfs-to-opfs') {
			await snapshotVfsToOpfs(
				this.api,
				options.mountpoint,
				opfsRoot,
				onProgress
			);
		} else if (options.initialSyncDirection === 'opfs-to-memfs') {
			await loadOpfsIntoVfs(
				this.api,
				options.mountpoint,
				opfsRoot,
				onProgress
			);
		} else {
			throw new Error(
				`KernelPlaygroundWorkerEndpoint.mountOpfs: unsupported ` +
					`initialSyncDirection '${options.initialSyncDirection}'.`
			);
		}
		this.opfsMounts.add(options.mountpoint);
	}

	/**
	 * Kernel-mode OPFS is a one-shot snapshot rather than a continuous
	 * journal, so there is no buffered state to flush. The method exists
	 * to match the classic-mode API surface the website / blueprint
	 * runner consume — calling it without a prior `mountOpfs` is a
	 * programming error and surfaces a clear message.
	 */
	async flushOpfs(mountpoint: string): Promise<void> {
		if (!this.opfsMounts.has(mountpoint)) {
			throw new Error(`No OPFS mount found at "${mountpoint}".`);
		}
		/* No journal to flush — see docstring. */
	}

	/**
	 * Drop the mountpoint from the tracked set. Symmetrical with
	 * `mountOpfs` so the caller can re-mount at the same path; the
	 * underlying OPFS directory is left alone (the persisted snapshot
	 * survives unmount).
	 */
	async unmountOpfs(mountpoint: string): Promise<void> {
		if (!this.opfsMounts.has(mountpoint)) {
			throw new Error(`No OPFS mount found at "${mountpoint}".`);
		}
		this.opfsMounts.delete(mountpoint);
	}

	/**
	 * Report whether an OPFS snapshot is currently mounted at `mountpoint`.
	 * The website's save flow calls this before saving a site to decide
	 * whether it must unmount an existing autosave mount first (see
	 * `persist-temporary-site.ts`). Mirrors the classic worker's
	 * `hasOpfsMount`; without it the Comlink method lookup resolves to
	 * `undefined` and the save fails with the generic "Cannot read
	 * properties of undefined (reading 'apply')".
	 */
	async hasOpfsMount(mountpoint: string): Promise<boolean> {
		return this.opfsMounts.has(mountpoint);
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

	/**
	 * Runtime marker for the website's terminal pane gating
	 * (`use-terminal-available.ts`). The classic worker endpoints have
	 * no such method, so calling it there rejects and the caller treats
	 * that as "not the kernel runtime". A method, not a boolean field:
	 * `proxyClone` in `@php-wasm/universal`'s `api.ts` has no `boolean`
	 * case, so a boolean field never survives the Comlink hop. The URL
	 * param can't serve as the signal either — the kernel dev server
	 * aliases `/remote.html` to this runtime without
	 * `?experimental=kandelo`.
	 */
	async isPosixKernel(): Promise<boolean> {
		return true;
	}

	/**
	 * Spawn an interactive shell on a kernel PTY. `onOutput` / `onExit`
	 * arrive Comlink-proxied from the website's terminal pane through
	 * the iframe wrapper in `boot-playground-remote.ts:startTerminal`.
	 * Returns the kernel pid the pane passes back to
	 * {@link writeToTerminal} / {@link resizeTerminal}.
	 */
	async startTerminal(
		size: TerminalSize,
		onOutput: (chunk: Uint8Array) => void,
		onExit: (code: number) => void
	): Promise<number> {
		return await this.requireTerminals('startTerminal').start(
			size,
			onOutput,
			onExit
		);
	}

	async writeToTerminal(pid: number, data: Uint8Array): Promise<void> {
		this.requireTerminals('writeToTerminal').write(pid, data);
	}

	async resizeTerminal(
		pid: number,
		rows: number,
		cols: number
	): Promise<void> {
		this.requireTerminals('resizeTerminal').resize(pid, rows, cols);
	}

	private requireTerminals(method: string): KernelTerminalManager {
		if (!this.terminals) {
			throw new Error(
				`KernelPlaygroundWorkerEndpoint.${method}: kernel is not booted.`
			);
		}
		return this.terminals;
	}

	private async doBoot(options: KernelWorkerBootOptions): Promise<void> {
		this.absoluteUrl = setURLScope(
			wordPressSiteUrl,
			options.scope
		).toString();

		const corsProxyUrl = options.corsProxyUrl ?? defaultCorsProxyUrl;
		// Resolve the install mode the same way the classic worker does
		// (`../playground-worker-endpoint-blueprints.ts`), keeping the
		// deprecated `shouldInstallWordPress` boolean working. PHP-only
		// mode (`do-not-attempt-installing`) skips both the WordPress
		// download/extraction and the post-boot install drive.
		const wordpressInstallMode: WordPressInstallMode =
			options.wordpressInstallMode ??
			(options.shouldInstallWordPress === false
				? 'install-from-existing-files-if-needed'
				: 'download-and-install');
		// Only PHP-only mode skips both gates. Existing-files modes still
		// run the install drive, which short-circuits when WordPress is
		// already present (see the `mountOpfs` restore below).
		const bootWordPress =
			wordpressInstallMode !== 'do-not-attempt-installing';
		const installWordPress =
			wordpressInstallMode !== 'do-not-attempt-installing';

		// Resolve the requested WordPress version the same way the cold-build
		// path does: `'nightly'` aliases to `'trunk'`, and anything not in the
		// minified bundle (e.g. `'latest'`) falls back to the bundled
		// `LatestMinifiedWordPressVersion`. Computed here so the snapshot gate
		// below can compare against it and the cold-build path can reuse it.
		const requestedWpVersion =
			(options.wpVersion === 'nightly' ? 'trunk' : options.wpVersion) ??
			LatestMinifiedWordPressVersion;
		const wpVersionQuery = MinifiedWordPressVersionsList.includes(
			requestedWpVersion
		)
			? requestedWpVersion
			: LatestMinifiedWordPressVersion;

		// The shared snapshot bakes the DEFAULT runtime config (networking
		// ON, intl OFF) at `LatestMinifiedWordPressVersion` — it is captured
		// once with those settings and cannot be re-tailored post-mount (the
		// image starts dinit immediately, with no seam to overlay per-boot
		// php-fpm config or a different WordPress build). So a boot that wants
		// networking-off, intl-on, or a non-default WordPress version must skip
		// the snapshot and cold-build the image with its requested config.
		const wantsDefaultConfig =
			options.withNetworking !== false &&
			!(options.extensions ?? []).includes('intl') &&
			wpVersionQuery === LatestMinifiedWordPressVersion;

		// Fast path: a fully prebuilt VFS image (e2e suite) lets us skip the
		// zip download AND `buildVfsImage` entirely. Non-fatal by design: the
		// globalSetup that produces the image does so on its own full-build
		// boot, so a missing/404 image must fall back to the full build, not
		// crash. Only meaningful when we're booting WordPress at all with the
		// default config the snapshot was baked with.
		let vfsImage: Uint8Array | undefined;
		if (
			bootWordPress &&
			options.prebuiltVfsImageUrl &&
			wantsDefaultConfig
		) {
			logger.debug(
				'[posix-kernel] fetching prebuilt VFS image ' +
					`from ${options.prebuiltVfsImageUrl}`
			);
			try {
				const imageBuffer = await fetchArrayBuffer(
					options.prebuiltVfsImageUrl,
					'prebuilt VFS image'
				);
				vfsImage = new Uint8Array(imageBuffer);
				logger.debug(
					'[posix-kernel] using prebuilt VFS image ' +
						`(${vfsImage.byteLength} bytes); skipping zip ` +
						'download + VFS build'
				);
			} catch (e) {
				logger.debug(
					'[posix-kernel] no prebuilt VFS image available ' +
						`(${(e as Error).message}); falling back to full build`
				);
			}
		}

		if (!vfsImage) {
			const withNetworking = options.withNetworking !== false;
			// intl is driven entirely by the blueprint's `extensions` array
			// (`features.intl` → `extensions: ['intl']` in the client handler);
			// no dedicated boot flag exists. Any non-default config lands here
			// because `wantsDefaultConfig` above forced the snapshot skip.
			const withIntl = (options.extensions ?? []).includes('intl');
			let wpZipBytes: Uint8Array | undefined;
			let sqliteZipBytes: Uint8Array | undefined;
			let wpZipStripLeadingDir: string | undefined;
			let wpStaticZipBytes: Uint8Array | undefined;
			if (bootWordPress) {
				logger.debug(
					`[posix-kernel] preparing WordPress zips (scope=${options.scope})`
				);
			} else {
				logger.debug(
					'[posix-kernel] PHP-only mode ' +
						'(wordpressInstallMode=do-not-attempt-installing); ' +
						'skipping WordPress download'
				);
			}
			const [zips, wpCliPharBytes] = await Promise.all([
				bootWordPress
					? prepareWordPressZips({
							wpVersionQuery,
							sqliteVersion: options.sqliteDriverVersion,
							corsProxyUrl,
							monitor: this.downloadMonitor,
							onStatus: (m) => logger.log(`[posix-kernel] ${m}`),
						})
					: undefined,
				downloadWpCliPhar(this.downloadMonitor),
			]);
			if (zips) {
				wpZipBytes = zips.wpZipBytes;
				sqliteZipBytes = zips.sqliteZipBytes;
				wpZipStripLeadingDir = zips.wpZipStripLeadingDir;
				wpStaticZipBytes = zips.wpStaticZipBytes;
				logger.debug(
					`[posix-kernel] WordPress ${zips.wpVersion} downloaded`
				);
			}

			// Fetch the pre-installed snapshot (e2e suite) so `buildVfsImage`
			// can seed it and skip the installer. Non-fatal by design: the
			// globalSetup that produces the fixture does so on its own first
			// boot, so a missing/404 fixture must fall back to the installer,
			// not crash.
			//
			// The DB snapshot is baked at `LatestMinifiedWordPressVersion`, and
			// its schema is version-specific. Seeding it into a cold-built image
			// for a DIFFERENT WordPress version (e.g. `?wp=6.3`) lands the older
			// core on a newer DB schema, so WordPress shows the "Database Update
			// Required" wall instead of the Dashboard. Gate the seed on a version
			// match so non-default versions run the fresh installer instead. (The
			// VFS-image gate above uses the stricter `wantsDefaultConfig`; the DB
			// seed only depends on the WordPress version, not on networking/intl,
			// so it can still be reused for those cold-builds at the latest
			// version.)
			let preinstalledDatabase: Uint8Array | undefined;
			if (
				bootWordPress &&
				wpVersionQuery === LatestMinifiedWordPressVersion &&
				options.preinstalledDatabaseUrl
			) {
				logger.debug(
					'[posix-kernel] fetching pre-installed database ' +
						`from ${options.preinstalledDatabaseUrl}`
				);
				try {
					const dbBuffer = await fetchArrayBuffer(
						options.preinstalledDatabaseUrl,
						'pre-installed database'
					);
					preinstalledDatabase = new Uint8Array(dbBuffer);
				} catch (e) {
					logger.debug(
						'[posix-kernel] no pre-installed database available ' +
							`(${(e as Error).message}); falling back to installer`
					);
				}
			}

			// Stash the build inputs so `captureVfsImage` (e2e globalSetup)
			// can re-serialize the image with the freshly-installed DB seeded
			// in — the snapshot every other test then boots from.
			this.vfsBuildInputs = {
				wpZipBytes,
				sqliteZipBytes,
				wpZipStripLeadingDir,
				wpStaticZipBytes,
				wpCliPharBytes,
				withNetworking,
				withIntl,
			};

			logger.debug('[posix-kernel] building VFS image');
			vfsImage = await buildVfsImage({
				...this.vfsBuildInputs,
				preinstalledDatabase,
				onStatus: (m) => logger.log(`[posix-kernel] ${m}`),
			});
		}

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
			corsProxyUrl,
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
		this.api = api;
		this.terminals = new KernelTerminalManager(this.kernel.kernel);

		// Block until the kernel-resident nginx/php-fpm actually answer.
		// Deferred out of `bootKernelWordPress` to here — after the spawn
		// adapter is live — so a boot where the service tree never binds
		// fails with the readiness error rather than a blind timeout.
		await this.kernel.waitForServerReady();

		// Restore saved sites before the install probe so it sees a
		// fully-installed WordPress and short-circuits.
		for (const mount of options.mounts ?? []) {
			if (mount.initialSyncDirection === 'opfs-to-memfs') {
				await this.mountOpfs(mount);
			}
		}

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
					'(wordpressInstallMode=do-not-attempt-installing)'
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

/**
 * Walk the kernel VFS subtree rooted at `vfsRoot` and write every file
 * found there into OPFS, mirroring the directory structure.
 *
 * Implementation: spawn `php` **once** with a `RecursiveDirectoryIterator`
 * script that streams a packed binary dump of every regular file to
 * stdout, then parse and replay the dump into OPFS. A previous version
 * of this used per-file `coreutils ls` / `test` / `cat` spawns, but
 * stock WordPress has ~10k files → ~30k `kernel.spawn()` calls, which
 * OOM'd the kernel worker with `WebAssembly.Memory(): could not
 * allocate memory` long before the walk completed. Collapsing to a
 * single PHP spawn keeps the wasm-process count at 1.
 *
 * Wire format (per file, repeated):
 *
 *   uint32 LE  path length
 *   bytes      path (relative to {@link vfsRoot}, forward slashes)
 *   uint32 LE  data length
 *   bytes      file contents
 *
 * The header carries the total entry count up front so the progress
 * callback can report a meaningful `total`.
 */
async function snapshotVfsToOpfs(
	api: KernelLimitedPHPApi,
	vfsRoot: string,
	opfsRoot: FileSystemDirectoryHandle,
	onProgress?: SyncProgressCallback
): Promise<void> {
	const dumpResult = await api.run({
		code: buildVfsDumpScript(vfsRoot),
	});

	const dump = dumpResult.bytes;
	const view = new DataView(dump.buffer, dump.byteOffset, dump.byteLength);
	const textDecoder = new TextDecoder('utf-8');

	let offset = 0;
	const total = view.getUint32(offset, true);
	offset += 4;

	onProgress?.({ files: 0, total });

	let synced = 0;
	for (let i = 0; i < total; i++) {
		const pathLen = view.getUint32(offset, true);
		offset += 4;
		const pathBytes = dump.subarray(offset, offset + pathLen);
		offset += pathLen;
		const dataLen = view.getUint32(offset, true);
		offset += 4;
		const data = dump.subarray(offset, offset + dataLen);
		offset += dataLen;

		const relPath = textDecoder.decode(pathBytes);
		const opfsPath = relPath.split('/').filter((p) => p.length > 0);
		await writeOpfsFile(opfsRoot, opfsPath, data);
		synced++;
		onProgress?.({ files: synced, total });
	}
}

/**
 * Build the PHP-CLI script the kernel worker spawns to enumerate and
 * dump the VFS subtree. The script:
 *
 *   1. Walks `vfsRoot` with `RecursiveDirectoryIterator`
 *      (`SKIP_DOTS | UNIX_PATHS`) and collects regular-file paths.
 *   2. Writes a `uint32 LE` count, then `[pathlen, path, datalen, data]`
 *      records to `php://stdout`. Paths are made relative to `vfsRoot`
 *      and use forward slashes — the JS side rebuilds the directory
 *      tree from the path components.
 *
 * `set_time_limit(0)` and `memory_limit = -1` keep PHP from killing
 * itself mid-walk on a stock WP install (default memory_limit is 128M;
 * file_get_contents on a large file plus output buffering can exceed
 * that). Errors from individual files are suppressed with `@` so a
 * single unreadable file doesn't abort the whole snapshot.
 */
function buildVfsDumpScript(vfsRoot: string): string {
	const rootLiteral = phpLiteralString(vfsRoot);
	return `
		ini_set('memory_limit', '-1');
		set_time_limit(0);
		$root = ${rootLiteral};
		$rootLen = strlen($root) + 1;
		$it = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator(
				$root,
				FilesystemIterator::SKIP_DOTS |
					FilesystemIterator::UNIX_PATHS
			),
			RecursiveIteratorIterator::LEAVES_ONLY
		);
		$files = [];
		foreach ($it as $info) {
			if ($info->isFile()) {
				$files[] = $info->getPathname();
			}
		}
		$out = fopen('php://stdout', 'wb');
		fwrite($out, pack('V', count($files)));
		foreach ($files as $path) {
			$rel = substr($path, $rootLen);
			$data = @file_get_contents($path);
			if ($data === false) {
				$data = '';
			}
			fwrite($out, pack('V', strlen($rel)));
			fwrite($out, $rel);
			fwrite($out, pack('V', strlen($data)));
			fwrite($out, $data);
		}
		fflush($out);
	`;
}

function phpLiteralString(value: string): string {
	return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * Reverse of {@link snapshotVfsToOpfs}: pack every OPFS file into the
 * same wire stream the dump path emits and pipe it to a single `php`
 * spawn that writes the records into `vfsRoot`. Single-spawn for the
 * OOM reason {@link snapshotVfsToOpfs} documents.
 */
async function loadOpfsIntoVfs(
	api: KernelLimitedPHPApi,
	vfsRoot: string,
	opfsRoot: FileSystemDirectoryHandle,
	onProgress?: SyncProgressCallback
): Promise<void> {
	const entries: Array<{ relPath: string; data: Uint8Array }> = [];
	await collectOpfsFiles(opfsRoot, [], entries);
	const total = entries.length;
	onProgress?.({ files: 0, total });

	if (total === 0) {
		return;
	}

	const wireStream = encodeVfsLoadStream(entries);
	await api.run({
		code: buildVfsLoadScript(vfsRoot),
		body: wireStream,
	});

	onProgress?.({ files: total, total });
}

async function collectOpfsFiles(
	dir: FileSystemDirectoryHandle,
	pathParts: string[],
	out: Array<{ relPath: string; data: Uint8Array }>
): Promise<void> {
	for await (const [name, handle] of dir.entries()) {
		const childPath = [...pathParts, name];
		if (handle.kind === 'directory') {
			await collectOpfsFiles(handle, childPath, out);
		} else {
			const file = await handle.getFile();
			const data = new Uint8Array(await file.arrayBuffer());
			out.push({ relPath: childPath.join('/'), data });
		}
	}
}

function encodeVfsLoadStream(
	entries: Array<{ relPath: string; data: Uint8Array }>
): Uint8Array {
	const textEncoder = new TextEncoder();
	const encodedPaths = entries.map((e) => textEncoder.encode(e.relPath));

	let totalBytes = 4;
	for (let i = 0; i < entries.length; i++) {
		totalBytes += 4 + encodedPaths[i].byteLength;
		totalBytes += 4 + entries[i].data.byteLength;
	}

	const buffer = new Uint8Array(totalBytes);
	const view = new DataView(buffer.buffer);
	let offset = 0;
	view.setUint32(offset, entries.length, true);
	offset += 4;
	for (let i = 0; i < entries.length; i++) {
		const pathBytes = encodedPaths[i];
		view.setUint32(offset, pathBytes.byteLength, true);
		offset += 4;
		buffer.set(pathBytes, offset);
		offset += pathBytes.byteLength;
		const data = entries[i].data;
		view.setUint32(offset, data.byteLength, true);
		offset += 4;
		buffer.set(data, offset);
		offset += data.byteLength;
	}
	return buffer;
}

/**
 * Mirror of {@link buildVfsDumpScript}: read the wire stream from
 * STDIN and replay it under `vfsRoot`. `read_exact` loops `fread`
 * because pipe reads aren't guaranteed to return the requested length
 * in one call — without it, a >8KB file would truncate and the next
 * length prefix would land out of alignment.
 */
function buildVfsLoadScript(vfsRoot: string): string {
	const rootLiteral = phpLiteralString(vfsRoot);
	return `
		ini_set('memory_limit', '-1');
		set_time_limit(0);
		$root = ${rootLiteral};
		$in = fopen('php://stdin', 'rb');
		$read_exact = function ($stream, $len) {
			$buf = '';
			while ($len > 0) {
				$chunk = fread($stream, $len);
				if ($chunk === false || $chunk === '') {
					return false;
				}
				$buf .= $chunk;
				$len -= strlen($chunk);
			}
			return $buf;
		};
		$header = $read_exact($in, 4);
		if ($header === false) {
			fwrite(STDERR, "load: short read on header\\n");
			exit(2);
		}
		$count = unpack('V', $header)[1];
		for ($i = 0; $i < $count; $i++) {
			$pathLen = unpack('V', $read_exact($in, 4))[1];
			$rel = $read_exact($in, $pathLen);
			$dataLen = unpack('V', $read_exact($in, 4))[1];
			$data = $dataLen > 0 ? $read_exact($in, $dataLen) : '';
			if ($rel === false || $data === false) {
				fwrite(STDERR, "load: short read at record $i\\n");
				exit(3);
			}
			$absPath = $root . '/' . $rel;
			@mkdir(dirname($absPath), 0777, true);
			@file_put_contents($absPath, $data);
		}
	`;
}

async function writeOpfsFile(
	opfsRoot: FileSystemDirectoryHandle,
	path: string[],
	data: Uint8Array
): Promise<void> {
	let dir = opfsRoot;
	for (let i = 0; i < path.length - 1; i++) {
		dir = await dir.getDirectoryHandle(path[i], { create: true });
	}
	const fileHandle = await dir.getFileHandle(path[path.length - 1], {
		create: true,
	});
	// Same fork as `directory-handle-mount.ts:265` — Chrome/Firefox get
	// `createWritable`, Safari (and other workers without it) fall back
	// to the synchronous access handle. The `await`s are no-ops on the
	// sync-access path but keep the call sites uniform.
	const opfsFile = fileHandle as unknown as {
		createWritable?: () => Promise<unknown>;
		createSyncAccessHandle?: () => Promise<unknown>;
	};
	const writer = (
		opfsFile.createWritable !== undefined
			? await opfsFile.createWritable()
			: await opfsFile.createSyncAccessHandle!()
	) as {
		truncate(size: number): unknown;
		write(buffer: Uint8Array): unknown;
		close(): unknown;
	};
	try {
		await writer.truncate(0);
		await writer.write(data);
	} finally {
		await writer.close();
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
	try {
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
	} catch (error) {
		logger.warn(
			`[posix-kernel] Failed to default to pretty permalinks ` +
				`after WP install: ${String(error)}`
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
