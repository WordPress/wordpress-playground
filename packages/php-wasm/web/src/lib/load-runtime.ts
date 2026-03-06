import type {
	SupportedPHPVersion,
	EmscriptenOptions,
	PHPLoaderModule,
} from '@php-wasm/universal';
import { loadPHPRuntime } from '@php-wasm/universal';
import { getPHPLoaderModule } from './get-php-loader-module';
import type { TCPOverFetchOptions } from './tcp-over-fetch-websocket';
import { tcpOverFetchWebsocket } from './tcp-over-fetch-websocket';
import { withIntl } from './extensions/intl/with-intl';
import {
	needsJspiPolyfill,
	installJspiPolyfill,
	PolyfillProxyWebSocket,
} from './jspi-polyfill';
import { sendSyncXhr } from './jspi-polyfill/sync-xhr-channel';

export interface LoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
	onPhpLoaderModuleLoaded?: (module: PHPLoaderModule) => void;
	tcpOverFetch?: TCPOverFetchOptions;
	withIntl?: boolean;
}

/**
 * Fake a websocket connection to prevent errors in the web app
 * from cascading and breaking the Playground.
 */
const fakeWebsocket = () => {
	return {
		websocket: {
			decorator: (WebSocketConstructor: any) => {
				return class FakeWebsocketConstructor extends WebSocketConstructor {
					constructor() {
						try {
							super();
						} catch {
							// pass
						}
					}

					send() {
						return null;
					}
				};
			},
		},
	};
};

interface PHPWorkerGlobalScope extends WorkerGlobalScope {
	setImmediate: (fn: () => void) => void;
}

export async function loadWebRuntime(
	phpVersion: SupportedPHPVersion,
	loaderOptions: LoaderOptions = {}
) {
	/*
	 * Provide `setImmediate` so Emscripten doesn't install its message-based
	 * polyfill, which retains references to the Wasm HEAP and prevents the
	 * PHP instance from being garbage-collected.
	 *
	 * https://github.com/emscripten-core/emscripten/blob/6d61ffd7076309cb08af37aba496f25c23cdb5a4/src/lib/libeventloop.js#L57
	 */
	if (!('setImmediate' in globalThis)) {
		(globalThis as unknown as PHPWorkerGlobalScope).setImmediate = (
			fn: () => void
		) => setTimeout(fn, 0);
	}

	const polyfillNeeded = await needsJspiPolyfill();

	let emscriptenOptions: EmscriptenOptions | Promise<EmscriptenOptions> = {
		...fakeWebsocket(),
		...(loaderOptions.emscriptenOptions || {}),
	};

	// When the polyfill is active, socket I/O is routed
	// through PolyfillProxyWebSocket → sync XHR → service
	// worker, so we skip the normal tcpOverFetchWebsocket()
	// decorator (it would be overwritten anyway).
	if (loaderOptions.tcpOverFetch && !polyfillNeeded) {
		emscriptenOptions = tcpOverFetchWebsocket(
			emscriptenOptions,
			loaderOptions.tcpOverFetch
		);
	}

	if (loaderOptions.withIntl) {
		emscriptenOptions = withIntl(phpVersion, emscriptenOptions);
	}

	const [phpLoaderModule, options] = await Promise.all([
		getPHPLoaderModule(phpVersion),
		emscriptenOptions,
	]);

	let finalOptions = options;
	if (polyfillNeeded) {
		// eslint-disable-next-line no-console
		console.info('This browser does not support JSPI. Using a polyfill.');
		installJspiPolyfill();

		if (loaderOptions.tcpOverFetch) {
			// Forward tcpOverFetchOptions to main thread so it
			// can relay them to the service worker. CryptoKey
			// objects are only structured-clonable via postMessage.
			self.postMessage({
				type: 'jspi-polyfill-options',
				tcpOverFetchOptions: loaderOptions.tcpOverFetch,
			});

			// Replace websocket decorator to use the sync XHR
			// proxy instead of a real TCPOverFetchWebSocket on
			// the worker (where the event loop is blocked).
			finalOptions = {
				...finalOptions,
				websocket: {
					url: (_: unknown, host: string, port: string) =>
						`ws://playground.internal/?${new URLSearchParams({ host, port })}`,
					subprotocol: 'binary',
					decorator: () =>
						PolyfillProxyWebSocket as unknown as typeof WebSocket,
				},
			};
		}

		finalOptions = wrapInstantiateWasmForPolyfill(finalOptions);
	}

	loaderOptions.onPhpLoaderModuleLoaded?.(phpLoaderModule);

	return await loadPHPRuntime(phpLoaderModule, finalOptions);
}

interface WasmRefs {
	memory: WebAssembly.Memory | null;
	malloc: ((size: number) => number) | null;
}

function wrapInstantiateWasmForPolyfill(
	options: EmscriptenOptions
): EmscriptenOptions {
	const wasmRefs: WasmRefs = { memory: null, malloc: null };
	const originalInstantiateWasm = options.instantiateWasm;
	if (!originalInstantiateWasm) {
		throw new Error(
			'JSPI polyfill requires emscriptenOptions.instantiateWasm. ' +
				'Provide a custom instantiateWasm hook so the polyfill ' +
				'can intercept WASM imports before instantiation.'
		);
	}
	return {
		...options,
		instantiateWasm(
			info: WebAssembly.Imports,
			receiveInstance: (
				instance: WebAssembly.Instance,
				module: WebAssembly.Module
			) => void
		) {
			patchAsyncImports(info, wasmRefs);
			return originalInstantiateWasm(info, (instance, module) => {
				wasmRefs.memory = instance.exports[
					'memory'
				] as WebAssembly.Memory;
				wasmRefs.malloc = instance.exports['malloc'] as (
					n: number
				) => number;
				receiveInstance(instance, module);
			});
		},
	};
}

function patchAsyncImports(
	info: WebAssembly.Imports,
	wasmRefs: WasmRefs
): void {
	const env = info['env'] as Record<string, unknown> | undefined;
	if (!env) return;

	// Clear stale state from a previous runtime instance
	// (e.g. runtime rotation). Socket IDs increment
	// monotonically so there's no collision risk, but
	// leftover entries waste memory.
	recvBuffers.clear();
	PolyfillProxyWebSocket.sockfdToSocketId.clear();

	// Wire up recv buffer cleanup for socket close.
	PolyfillProxyWebSocket.onSocketClosed = (socketId: number) => {
		recvBuffers.delete(socketId);
	};

	// Remove the Suspending polyfill now that
	// instrumentWasmImports has already used it. Functions
	// like _wasm_connect check 'Suspending' in WebAssembly
	// to choose between sync/async paths. With the polyfill
	// the async path breaks (handleAsync's await creates a
	// real async gap WASM can't handle), so we need them to
	// take their synchronous fallback instead.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	delete (WebAssembly as any).Suspending;

	if (typeof env['emscripten_sleep'] === 'function') {
		env['emscripten_sleep'] = (ms: number) => {
			sendSyncXhr('sleep', { ms });
		};
	}

	if (typeof env['emscripten_wget_data'] === 'function') {
		env['emscripten_wget_data'] = (
			urlPtr: number,
			pbuffer: number,
			pnum: number,
			perror: number
		) => {
			polyfillEmscriptenWgetData(wasmRefs, urlPtr, pbuffer, pnum, perror);
		};
	}

	// __syscall_recvfrom: Emscripten syscall backing libc
	// recv()/recvfrom(). Curl calls recv() which goes here.
	// The original reads from sock.recv_queue (populated by
	// WebSocket onmessage), which is always empty for our
	// PolyfillProxyWebSocket. Patch to use sync XHR instead.
	// Handles MSG_PEEK via local buffering.
	if (typeof env['__syscall_recvfrom'] === 'function') {
		const originalRecvFrom = env['__syscall_recvfrom'] as (
			...args: number[]
		) => number;
		env['__syscall_recvfrom'] = (
			fd: number,
			buf: number,
			len: number,
			flags: number,
			addr: number,
			addrlen: number
		): number => {
			return polyfillRecvFrom(
				wasmRefs,
				originalRecvFrom,
				fd,
				buf,
				len,
				flags,
				addr,
				addrlen
			);
		};
	}

	// wasm_recv / recv: PHP's socket layer calls wasm_recv
	// (defined in phpwasm-emscripten-library.js) which
	// internally polls __syscall_recvfrom. Replace with
	// direct sync XHR recv via the same shared buffer.
	for (const name of ['wasm_recv', 'recv'] as const) {
		if (typeof env[name] === 'function') {
			const original = env[name] as (...args: number[]) => number;
			env[name] = (
				sockfd: number,
				buffer: number,
				size: number,
				flags: number
			): number => {
				return polyfillRecv(
					wasmRefs,
					original,
					sockfd,
					buffer,
					size,
					flags
				);
			};
		}
	}

	// __syscall_connect: wrap to capture sockfd → socketId
	// mapping after each connect call.
	if (typeof env['__syscall_connect'] === 'function') {
		const original = env['__syscall_connect'] as (
			sockfd: number,
			addr: number,
			addrlen: number
		) => number;
		env['__syscall_connect'] = (
			sockfd: number,
			addr: number,
			addrlen: number
		) => {
			const result = original(sockfd, addr, addrlen);
			if (PolyfillProxyWebSocket.lastCreatedSocketId > 0) {
				PolyfillProxyWebSocket.sockfdToSocketId.set(
					sockfd,
					PolyfillProxyWebSocket.lastCreatedSocketId
				);
				PolyfillProxyWebSocket.lastCreatedSocketId = 0;
			}
			return result;
		};
	}

	// fd_sync: no-op — the in-memory FS is already
	// up-to-date; only IDB persistence is skipped.
	if (typeof env['fd_sync'] === 'function') {
		env['fd_sync'] = () => 0;
	}
	const wasi = info['wasi_snapshot_preview1'] as
		| Record<string, unknown>
		| undefined;
	if (wasi && typeof wasi['fd_sync'] === 'function') {
		wasi['fd_sync'] = () => 0;
	}

	// fd_read: WASI read. PHP's file_get_contents uses
	// read() → fd_read → FS.read() → SOCKFS recvmsg,
	// which reads from sock.recv_queue. That queue is
	// always empty for our PolyfillProxyWebSocket because
	// onmessage events never fire. Intercept reads on
	// polyfilled socket FDs and use sync XHR instead.
	if (wasi && typeof wasi['fd_read'] === 'function') {
		const originalFdRead = wasi['fd_read'] as (...args: number[]) => number;
		wasi['fd_read'] = (
			fd: number,
			iov: number,
			iovcnt: number,
			pnum: number
		): number => {
			const socketId = PolyfillProxyWebSocket.sockfdToSocketId.get(fd);
			if (socketId === undefined) {
				return originalFdRead(fd, iov, iovcnt, pnum);
			}
			return polyfillFdRead(wasmRefs, socketId, iov, iovcnt, pnum);
		};
	}

	// wasm_poll_socket: EM_ASYNC_JS function used by
	// __wrap_select and php_pollfd_for to wait for socket
	// events. Return 1 immediately so curl's select() sees
	// the socket as ready; polyfillRecv handles the actual
	// blocking when curl calls recv().
	if (typeof env['__asyncjs__wasm_poll_socket'] === 'function') {
		env['__asyncjs__wasm_poll_socket'] = () => 1;
	}

	// js_module_onMessage: EM_ASYNC_JS function called by
	// post_message_to_js(). Replace with synchronous sync
	// XHR version that routes the message to the service
	// worker for processing.
	if (typeof env['__asyncjs__js_module_onMessage'] === 'function') {
		env['__asyncjs__js_module_onMessage'] = (
			dataPtr: number,
			responseBufferPtr: number
		): number => {
			return polyfillJsModuleOnMessage(
				wasmRefs,
				dataPtr,
				responseBufferPtr
			);
		};
	}
}

function polyfillEmscriptenWgetData(
	wasmRefs: WasmRefs,
	urlPtr: number,
	pbuffer: number,
	pnum: number,
	perror: number
): void {
	const urlBytes = readCString(wasmRefs, urlPtr);

	// Send to service worker for fetching. No chunking
	// needed — sync XHR returns the full response.
	const response = sendSyncXhr('fetch', {}, urlBytes);

	if (!response.ok) {
		const view = new DataView(wasmRefs.memory!.buffer);
		view.setInt32(pbuffer, 0, true);
		view.setInt32(pnum, 0, true);
		view.setInt32(perror, 1, true);
		return;
	}

	const totalLength = response.data.length;

	// Allocate WASM buffer via malloc.
	const ptr = wasmRefs.malloc!(totalLength);

	// Re-read memory.buffer after malloc — memory growth
	// can detach the old ArrayBuffer.
	const newMem = new Uint8Array(wasmRefs.memory!.buffer);
	newMem.set(response.data, ptr);

	// Write output pointers.
	const view = new DataView(wasmRefs.memory!.buffer);
	view.setInt32(pbuffer, ptr, true);
	view.setInt32(pnum, totalLength, true);
	view.setInt32(perror, 0, true);
}

/**
 * Local recv buffer per socket. Bridges MSG_PEEK (which
 * reads without consuming) and normal recv. When data is
 * fetched from the service worker it's stored here; peek
 * reads leave it in place, normal reads consume it.
 */
const recvBuffers = new Map<number, Uint8Array>();

/**
 * Replacement for Emscripten's __syscall_recvfrom. Called
 * by libc recv()/recvfrom() — this is curl's recv path.
 */
function polyfillRecvFrom(
	wasmRefs: WasmRefs,
	originalRecvFrom: (...args: number[]) => number,
	fd: number,
	buf: number,
	len: number,
	flags: number,
	addr: number,
	addrlen: number
): number {
	return polyfillRecvCommon(
		wasmRefs,
		() => originalRecvFrom(fd, buf, len, flags, addr, addrlen),
		fd,
		buf,
		len,
		flags
	);
}

/**
 * Replacement for wasm_recv / recv (PHP's socket layer).
 * Falls back to the original for non-polyfilled sockets.
 */
function polyfillRecv(
	wasmRefs: WasmRefs,
	original: (...args: number[]) => number,
	sockfd: number,
	buffer: number,
	size: number,
	flags: number
): number {
	return polyfillRecvCommon(
		wasmRefs,
		() => original(sockfd, buffer, size, flags),
		sockfd,
		buffer,
		size,
		flags
	);
}

/**
 * Shared recv logic: looks up the socket, falls back to
 * the original if not polyfilled, otherwise fetches from
 * the local buffer and copies into WASM memory.
 */
function polyfillRecvCommon(
	wasmRefs: WasmRefs,
	callOriginal: () => number,
	fd: number,
	buf: number,
	len: number,
	flags: number
): number {
	const socketId = PolyfillProxyWebSocket.sockfdToSocketId.get(fd);
	if (socketId === undefined) {
		return callOriginal();
	}

	const data = recvFromBuffer(socketId, len, flags);
	if (data.length === 0) return 0;

	new Uint8Array(wasmRefs.memory!.buffer).set(data, buf);
	return data.length;
}

/**
 * Shared recv implementation. Checks the local buffer
 * first, fetches from the service worker if empty.
 * Handles MSG_PEEK (flag 2) by not consuming the buffer.
 */
function recvFromBuffer(
	socketId: number,
	maxSize: number,
	flags: number
): Uint8Array {
	const MSG_PEEK = 2;
	const isPeek = (flags & MSG_PEEK) !== 0;

	let buffered = recvBuffers.get(socketId);
	if (!buffered || buffered.length === 0) {
		const response = sendSyncXhr('sock-recv', {
			socketId,
			maxSize,
		});
		if (!response.ok || response.data.length === 0) {
			return new Uint8Array(0);
		}
		buffered = response.data;
	}

	const toRead = Math.min(maxSize, buffered.length);
	const result = buffered.subarray(0, toRead);

	if (isPeek) {
		recvBuffers.set(socketId, buffered);
	} else {
		const remaining = buffered.subarray(toRead);
		if (remaining.length > 0) {
			recvBuffers.set(socketId, remaining);
		} else {
			recvBuffers.delete(socketId);
		}
	}

	return result;
}

/**
 * WASI fd_read replacement for polyfilled socket FDs.
 * Reads from the service worker via sync XHR, filling
 * the iov scatter/gather buffers.
 */
function polyfillFdRead(
	wasmRefs: WasmRefs,
	socketId: number,
	iov: number,
	iovcnt: number,
	pnum: number
): number {
	let totalRead = 0;

	for (let i = 0; i < iovcnt; i++) {
		// Re-read DataView each iteration — memory.buffer
		// can be detached if recvFromBuffer triggers growth.
		const view = new DataView(wasmRefs.memory!.buffer);
		const ptr = view.getUint32(iov + i * 8, true);
		const len = view.getUint32(iov + i * 8 + 4, true);

		const data = recvFromBuffer(socketId, len, 0);
		if (data.length > 0) {
			new Uint8Array(wasmRefs.memory!.buffer).set(data, ptr);
			totalRead += data.length;
		}
		if (data.length < len) break;
	}

	// Re-read after loop in case memory grew.
	new DataView(wasmRefs.memory!.buffer).setUint32(pnum, totalRead, true);
	return 0;
}

/**
 * Synchronous sync XHR replacement for js_module_onMessage
 * (the EM_ASYNC_JS function behind post_message_to_js).
 *
 * Sends the message string to the service worker, receives
 * the raw HTTP response bytes, allocates a WASM buffer via
 * malloc, writes the pointer into response_buffer, and
 * returns the response size (or -1 on error).
 */
function polyfillJsModuleOnMessage(
	wasmRefs: WasmRefs,
	dataPtr: number,
	responseBufferPtr: number
): number {
	const messageBytes = readCString(wasmRefs, dataPtr);

	// Send to service worker for processing.
	const response = sendSyncXhr('msg', {}, messageBytes);

	if (!response.ok) {
		return -1;
	}

	const totalLength = response.data.length;

	// Allocate WASM buffer via malloc (+1 for null terminator).
	const ptr = wasmRefs.malloc!(totalLength + 1);

	// Re-read memory.buffer after malloc — memory growth
	// can detach the old ArrayBuffer.
	const mem = new Uint8Array(wasmRefs.memory!.buffer);
	mem.set(response.data, ptr);
	mem[ptr + totalLength] = 0;

	// Write pointer to response_buffer (4 bytes LE).
	const view = new DataView(wasmRefs.memory!.buffer);
	view.setInt32(responseBufferPtr, ptr, true);

	return totalLength;
}

function readCString(wasmRefs: WasmRefs, ptr: number): Uint8Array {
	const mem = new Uint8Array(wasmRefs.memory!.buffer);
	let end = ptr;
	while (mem[end] !== 0) end++;
	// subarray avoids copying — safe because the sync XHR
	// in callers blocks the thread, preventing WASM from
	// modifying this memory before it's consumed.
	return mem.subarray(ptr, end);
}
