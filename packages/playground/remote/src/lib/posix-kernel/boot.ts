/**
 * Boot WordPress backed by kandelo in the browser.
 *
 * Browser counterpart to `playground/cli/src/posix-kernel/boot.ts`.
 * Where the CLI spawns a Node worker thread that owns the kernel and
 * uses native sockets, the browser path:
 *
 *   1. Takes a `KandeloImageFs` VFS image populated with WordPress +
 *      the SQLite drop-in + nginx/php-fpm configs (see
 *      `vfs-builder.ts`).
 *   2. Spawns a `BrowserKernel` (web worker hosting the kernel Wasm),
 *      hands it the VFS image and the kernel binary bytes, then spawns
 *      the php-fpm and nginx daemons from the VFS.
 *   3. Wires an in-worker `HttpBridgeHost` so the kernel's TCP
 *      listener on port 8080 (nginx) becomes the request path for
 *      the `request()` API exposed by the Comlink worker.
 *
 * Returns a `KernelBootResult` containing the bridge endpoint and a
 * disposer so the Comlink worker can:
 *
 *   - Forward `request()` calls into the bridge and resolve with the
 *     full HTTP response (mirrors how nginx+fpm serves WP requests in
 *     the CLI).
 *   - Tear the kernel down cleanly on `destroy()`.
 */

import { logger } from '@php-wasm/logger';
import { BrowserKernel, HttpBridgeHost } from './host-bridge';
import type { HttpRequest, HttpResponse } from './host-bridge';
import { waitForNginx } from './nginx-readiness';

/**
 * Per-spawn output capture handler installed by
 * {@link KernelBootResult.setCapture}. When a handler is set, every
 * stdout/stderr chunk from the kernel goes to it instead of the default
 * logger sink — so service-side output stops surfacing in the console
 * while a blueprint step is running.
 */
export type CaptureHandler = (
	chunk: Uint8Array,
	stream: 'stdout' | 'stderr'
) => void;

/**
 * Default nginx listen port inside the kernel. nginx.conf in the VFS
 * baked by `vfs-builder.ts` binds to `127.0.0.1:8080`; the bridge
 * connects to that port to route `request()` calls.
 */
const KERNEL_HTTP_PORT = 8080;
/**
 * How long to wait for the kernel-resident nginx to answer on :8080
 * before giving up. This is NOT the request path — it only bounds the
 * one-time startup race between the daemon spawns and php-fpm loading
 * `php.wasm` plus the `zip`/`curl`/`phar` side modules.
 *
 * The daemons can need ~15s to come up on a loaded CI runner. The
 * ceiling only bounds the failure case: on a fast boot `waitForNginx`
 * resolves the instant nginx answers, so a generous value costs
 * nothing. Well under the 300s Playwright test timeout.
 */
const NGINX_READY_TIMEOUT_MS = 60_000;

export interface KernelBootOptions {
	/** Pre-built VFS image bytes (from `KandeloImageFs.saveImage()`). */
	vfsImage: Uint8Array;
	/** Kernel `kernel.wasm` bytes. */
	kernelWasm: ArrayBuffer;
	/** The argv of each daemon to spawn, from `serverDaemons()`. */
	daemons: string[][];
	/**
	 * CORS proxy prefix for the kernel's TLS-MITM network backend. When set,
	 * every outbound fetch the kernel makes (including PHP
	 * `file_get_contents()` to CORS-disabled origins) is routed through this
	 * proxy so the browser receives a readable response body. Mirrors the
	 * `corsProxyUrl` the V1 web runtime passes to its own transport.
	 */
	corsProxyUrl?: string;
}

export interface KernelBootResult {
	/**
	 * Send an HTTP request to the kernel-resident nginx. Used by the
	 * Comlink worker to implement `request()` / `requestStreamed()`.
	 */
	sendRequest: (request: HttpRequest) => Promise<HttpResponse>;
	/**
	 * The live `BrowserKernel` instance. `KernelSpawnAdapter` uses this
	 * to spawn `coreutils.wasm` / `php.wasm` against the kernel-resident
	 * VFS — the only way to mutate the VFS from the host once
	 * `kernelOwnedFs: true` is set.
	 */
	kernel: BrowserKernel;
	/**
	 * Install or remove a per-spawn capture handler. `BrowserKernel`'s
	 * `onStdout` / `onStderr` are constructor-time singletons (no
	 * per-pid routing), so capturing a spawned program's output requires
	 * coordinating with the global handler set up below. Passing `null`
	 * reverts to the default logger sink. The contract: only one
	 * capture is active at a time; the adapter serializes spawn calls
	 * so this is sufficient.
	 */
	setCapture: (handler: CaptureHandler | null) => void;
	/**
	 * Block until the kernel-resident nginx answers on :8080 (php-fpm
	 * upstream reachable), or reject after {@link NGINX_READY_TIMEOUT_MS}.
	 * Not awaited inside {@link bootKernelWordPress}; the caller decides
	 * when to wait.
	 */
	waitForServerReady: () => Promise<void>;
}

export async function bootKernelWordPress(
	options: KernelBootOptions
): Promise<KernelBootResult> {
	// One capture slot — the adapter serializes spawn calls so a stack
	// isn't needed. Service-side stdout/stderr that race in while a
	// capture is active gets attributed to the captured spawn, which is
	// why nginx/php-fpm in `vfs-builder.ts` are configured to log to
	// files rather than stdout.
	let activeCapture: CaptureHandler | null = null;
	const setCapture = (handler: CaptureHandler | null): void => {
		activeCapture = handler;
	};
	const routeChunk = (
		data: Uint8Array,
		stream: 'stdout' | 'stderr'
	): void => {
		if (activeCapture) {
			activeCapture(data, stream);
			return;
		}
		const text = new TextDecoder().decode(data);
		if (stream === 'stderr') {
			logger.warn('[posix-kernel]', text);
		} else {
			logger.debug('[posix-kernel]', text);
		}
	};

	const kernel = new BrowserKernel({
		kernelOwnedFs: true,
		maxWorkers: 8,
		maxMemoryPages: 4096,
		corsProxy: options.corsProxyUrl
			? {
					url: new URL(options.corsProxyUrl, self.location.href).href,
					allowedRequestHeaderNames: [
						'accept',
						'content-type',
						'range',
						'wp_blog',
						'wp_install',
					],
					allowAnonymousGetHeaderOmission: true,
					rangeRequestHeaderAlias: 'x-cors-proxy-range',
				}
			: undefined,
		onStdout: (data: Uint8Array) => routeChunk(data, 'stdout'),
		onStderr: (data: Uint8Array) => routeChunk(data, 'stderr'),
		onListenTcp: (_pid: number, _fd: number, port: number) => {
			logger.debug(`[posix-kernel] service listening on :${port}`);
		},
	});

	// Bridge between this worker and the kernel worker. The
	// `HttpBridgeHost` produces a MessageChannel; we send `port1` to
	// the kernel worker via `sendBridgePort()` and keep `port2` here
	// for `sendRequest()`.
	const bridge = new HttpBridgeHost();

	await kernel.initFromImage({
		kernelWasm: options.kernelWasm,
		vfsImage: options.vfsImage,
	});

	// Wire the kernel worker to consume requests from port1 of the
	// channel. After this call, sending a request on the host-side
	// port is routed to the kernel's TCP listener.
	kernel.sendBridgePort(bridge.detachHostPort(), KERNEL_HTTP_PORT);

	for (const argv of options.daemons) {
		const { exit } = await kernel.spawnFromVfs(argv[0], argv, {
			env: [
				'HOME=/root',
				'TERM=xterm-256color',
				'PATH=/usr/local/bin:/usr/bin:/bin:/sbin:/usr/sbin',
			],
		});
		exit.then(
			(status: number) =>
				logger.debug(
					`[posix-kernel] ${argv[0]} exited with status ${status}`
				),
			(error: unknown) =>
				logger.error(`[posix-kernel] ${argv[0]} failed:`, error)
		);
	}

	const sendRequest = createRequestSender(bridge);

	return {
		sendRequest,
		kernel,
		setCapture,
		// `kernel.spawnFromVfs()` resolves as soon as the kernel has
		// registered each daemon — not when php-fpm and nginx have bound
		// their sockets. Until nginx is listening on :8080 the bridge
		// rejects every request with "No in-kernel listener for port
		// 8080". Poll `GET /` through the bridge until nginx answers with
		// a status other than 502/503/504 (php-fpm upstream not ready).
		waitForServerReady: () =>
			waitForNginx(sendRequest, NGINX_READY_TIMEOUT_MS),
	};
}

/**
 * Wrap `HttpBridgeHost` request/response handling into a request-
 * promise interface. The bridge surface exposes raw MessagePort
 * messages; the Comlink worker needs a `(request) => response`
 * function.
 */
function createRequestSender(bridge: HttpBridgeHost) {
	let nextId = 1;
	const pending = new Map<
		number,
		{ resolve: (r: HttpResponse) => void; reject: (e: Error) => void }
	>();

	// HttpBridgeHost was designed for service-worker → main thread
	// dispatch. Here we use it in reverse: `detachHostPort()` returns
	// `port1` and we ship it to the kernel worker via
	// `sendBridgePort(...)`, so the KERNEL ends up owning port1. The
	// still-live host-side port is `port2`, accessible via
	// `getSwPort()` — we use that to SEND requests rather than
	// receive. We piggyback on the bridge protocol by listening for
	// `http-response` / `http-error` and sending `http-request`
	// frames in the same shape.
	const hostPort = bridge.getSwPort();
	hostPort.onmessage = (event: MessageEvent) => {
		const msg = event.data;
		if (msg?.type === 'http-response') {
			const entry = pending.get(msg.requestId);
			if (entry) {
				pending.delete(msg.requestId);
				entry.resolve({
					status: msg.status,
					headers: msg.headers,
					body: msg.body,
				});
			}
		} else if (msg?.type === 'http-error') {
			const entry = pending.get(msg.requestId);
			if (entry) {
				pending.delete(msg.requestId);
				entry.reject(new Error(msg.error || 'Bridge request failed'));
			}
		}
	};

	return function sendRequest(request: HttpRequest): Promise<HttpResponse> {
		const requestId = nextId++;
		// nginx's vhost (`NGINX_CONF` in `vfs-builder.ts` —
		// `server_name localhost`) is HTTP/1.1 and rejects any request
		// without a `Host:` header with a 400 (RFC 7230 §5.4). The
		// bridge's `buildRawHttpRequest` (`kandelo/host/src/networking/
		// in-kernel-http.ts`) does not synthesize a Host of its own — it
		// writes exactly the headers we hand it. The
		// CLI doesn't trip this because it calls Node's `fetch()`,
		// which adds Host from the URL automatically. Inject it here so
		// every bridge request (waitForNginx polling, install probe,
		// blueprint `request()` calls, and so on) goes out well-formed.
		const headers = withDefaultHeaders(request.headers);
		return new Promise<HttpResponse>((resolve, reject) => {
			pending.set(requestId, { resolve, reject });
			hostPort.postMessage({
				type: 'http-request',
				requestId,
				method: request.method,
				url: request.url,
				headers,
				body: request.body,
			});
		});
	};
}

/**
 * Ensure every bridge request carries a `Host:` header. nginx returns
 * 400 Bad Request without it on HTTP/1.1 — see the rationale in
 * `createRequestSender`. `localhost` matches the nginx `server_name`
 * baked into the VFS.
 */
function withDefaultHeaders(
	headers: Record<string, string> | undefined
): Record<string, string> {
	const out: Record<string, string> = { ...(headers ?? {}) };
	const hasHost = Object.keys(out).some((k) => k.toLowerCase() === 'host');
	if (!hasHost) {
		out['Host'] = 'localhost';
	}
	return out;
}
