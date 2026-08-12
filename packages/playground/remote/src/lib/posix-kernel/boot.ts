/**
 * Boot WordPress backed by kandelo in the browser.
 *
 * Browser counterpart to `playground/cli/src/posix-kernel/boot.ts`.
 * Where the CLI spawns a Node worker thread that owns the kernel and
 * uses native sockets, the browser path:
 *
 *   1. Builds a `MemoryFileSystem` VFS image at boot time, populated
 *      with WordPress + the SQLite drop-in + nginx/php-fpm configs
 *      (see `vfs-builder.ts`).
 *   2. Spawns a `BrowserKernel` (web worker hosting the kernel Wasm)
 *      and hands it the VFS image and the kernel binary bytes.
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
 * one-time startup race between `kernel.boot()` resolving (dinit is PID
 * 1) and dinit exec'ing php-fpm (which must load the 18 MB `php.wasm`
 * plus the `zip`/`curl`/`phar` side modules) and then nginx.
 *
 * 60s, not 15s: CI's `[diag]` dump caught nginx logging `start worker
 * processes` exactly ONE SECOND after the old 15s wait expired —
 * php-fpm.log was empty (clean start) and dinit reported `[  OK  ]`
 * for every service, so nothing crashed; the service tree simply needs
 * ~15s to come up under a loaded 3-worker CI runner, and the wait was
 * losing that race by a hair. The ceiling only bounds the failure case:
 * on a fast boot `waitForNginx` resolves the instant nginx answers, so a
 * generous value costs nothing and just stops flaking when the runner is
 * slow. Well under the 300s Playwright test timeout.
 */
const NGINX_READY_TIMEOUT_MS = 60_000;

export interface KernelBootOptions {
	/** Pre-built VFS image bytes (from `MemoryFileSystem.saveImage()`). */
	vfsImage: Uint8Array;
	/** Kernel `kernel.wasm` bytes. */
	kernelWasm: ArrayBuffer;
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
	 *
	 * Deliberately NOT awaited inside {@link bootKernelWordPress}: the
	 * caller runs it only after building the spawn adapter, so a boot
	 * where the service tree never binds can read the in-kernel
	 * `php-fpm.log` / `nginx.log` back out (via the adapter) and surface
	 * them before rethrowing — otherwise the failure is a blind timeout
	 * with the one diagnostic we need trapped inside the dead kernel.
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
		corsProxyUrl: options.corsProxyUrl,
		onStdout: (data: Uint8Array) => routeChunk(data, 'stdout'),
		onStderr: (data: Uint8Array) => routeChunk(data, 'stderr'),
		onListenTcp: (_pid: number, _fd: number, port: number) => {
			logger.debug(`[posix-kernel] service listening on :${port}`);
		},
	});

	// Bridge between this worker and the kernel worker. The
	// `HttpBridgeHost` produces a MessageChannel; we send `port2` to
	// the kernel worker via `sendBridgePort()` and keep `port1` here
	// for `sendRequest()`.
	const bridge = new HttpBridgeHost();

	// Boot. dinit (PID 1) starts php-fpm → nginx inside the VFS.
	// See `vfs-builder.ts` for the service tree.
	const { exit } = await kernel.boot({
		kernelWasm: options.kernelWasm,
		vfsImage: options.vfsImage,
		// `/tmp` is an ephemeral scratch memfs whose default ceiling is
		// only 16 MiB (kandelo `BROWSER_SCRATCH_SAB_BYTES`). Blueprint
		// plugin/theme installs download the archive to `/tmp` before
		// unzipping, so a large plugin (e.g. Gutenberg / phpMyAdmin,
		// ~10-15 MiB) overflows it and the write fails with ENOSPC ("No
		// space left on device"). Enlarge it well past any single plugin
		// zip. The SAB is lazily paged, so the higher ceiling only costs
		// what is actually written.
		scratchSabBytes: { '/tmp': 256 * 1024 * 1024 },
		argv: ['/sbin/dinit', '--container', '-p', '/tmp/dinitctl'],
		env: [
			'HOME=/root',
			'TERM=xterm-256color',
			'PATH=/usr/local/bin:/usr/bin:/bin:/sbin:/usr/sbin',
		],
	});

	// Wire the kernel worker to consume requests from `bridge.port`
	// (port2 of the channel). After this call, sending a request on
	// the host-side port is routed to the kernel's TCP listener.
	kernel.sendBridgePort(bridge.detachHostPort(), KERNEL_HTTP_PORT);

	exit.then(
		(status: number) =>
			logger.debug(`[posix-kernel] dinit exited with status ${status}`),
		(error: unknown) => logger.error('[posix-kernel] dinit failed:', error)
	);

	const sendRequest = createRequestSender(bridge);

	// `BrowserKernel.nextPid` is initialized to 100
	// (`kandelo/examples/browser/lib/browser-kernel.ts:104`),
	// but the kernel's internal process table is already populated past
	// that mark: dinit (PID 1), php-fpm, nginx, plus every php-fpm
	// worker forked under the load php-fpm hits while serving the
	// install probe. When `KernelSpawnAdapter` makes its first
	// `kernel.spawn()` call, `nextPid++` hands out 100, which the kernel
	// rejects with EEXIST. Bump the host counter past the kernel's
	// reserved range. The kernel's own forks won't reach 10000 in
	// practice (php-fpm static pool stays at 2 workers, and other
	// services don't reproduce), so this avoids any collision without
	// coordinating with the kernel's PID allocator. Done eagerly (before
	// the readiness wait) so the counter is safe for the very first
	// adapter spawn — including the diagnostic log read the caller runs
	// when `waitForServerReady` rejects.
	(kernel as { nextPid: number }).nextPid = 10000;

	return {
		sendRequest,
		kernel,
		setCapture,
		// `kernel.boot()` resolves as soon as the kernel itself is ready —
		// not when dinit's child services (php-fpm, nginx) have bound
		// their sockets. Until nginx is listening on :8080 the bridge
		// rejects every request with "No in-kernel listener for port
		// 8080". Poll `GET /` through the bridge until any HTTP status
		// comes back. The caller awaits this only after the spawn adapter
		// exists so a never-binds failure can dump the service logs.
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
		// nginx's vhost (`vfs-builder.ts:697` — `server_name localhost`)
		// is HTTP/1.1 and rejects any request without a `Host:` header
		// with a 400 (RFC 7230 §5.4). The bridge's
		// `buildRawHttpRequest` (`kandelo/examples/browser/
		// lib/kernel-worker-entry.ts:1129`) does not synthesize a Host
		// of its own — it writes exactly the headers we hand it. The
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
