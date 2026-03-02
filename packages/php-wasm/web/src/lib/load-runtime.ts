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
import type { SharedChannel } from './jspi-polyfill';
import {
	needsJspiPolyfill,
	installJspiPolyfill,
	createSharedChannel,
	sendRequestFromWorker,
	PolyfillProxyWebSocket,
	setPolyfillChannel,
	REQUEST_SLEEP,
	REQUEST_FETCH_URL,
	REQUEST_FETCH_URL_CHUNK,
	REQUEST_SOCKET_RECV,
	REQUEST_MESSAGE,
} from './jspi-polyfill';

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
	 * Provide `setImmediate` so Emscripten doesn’t install its message-based
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

	let emscriptenOptions: EmscriptenOptions | Promise<EmscriptenOptions> = {
		...fakeWebsocket(),
		...(loaderOptions.emscriptenOptions || {}),
	};

	if (loaderOptions.tcpOverFetch) {
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
	if (await needsJspiPolyfill()) {
		// eslint-disable-next-line no-console
		console.info('This browser does not support JSPI. Using a polyfill.');
		installJspiPolyfill();
		const channel = createSharedChannel();
		setPolyfillChannel(channel);

		// The main thread must install the SAB listener
		// (setupJspiPolyfillListener) before the worker
		// reaches this point. This is safe because the
		// worker signals 'worker-script-started' first,
		// the main thread installs the listener upon
		// receiving it, and only then does the worker
		// proceed to call loadWebRuntime().
		self.postMessage({
			type: 'jspi-polyfill-channel',
			sab: channel.sab,
			tcpOverFetchOptions: loaderOptions.tcpOverFetch,
		});

		// Replace websocket decorator to use the SAB proxy
		// instead of a real TCPOverFetchWebSocket on the
		// worker (where the event loop is blocked).
		if (loaderOptions.tcpOverFetch) {
			finalOptions = {
				...finalOptions,
				websocket: {
					url: (_: unknown, host: string, port: string) =>
						`ws://playground.internal/?host=${host}&port=${port}`,
					subprotocol: 'binary',
					decorator: () =>
						PolyfillProxyWebSocket as unknown as typeof WebSocket,
				},
			};
		}

		finalOptions = wrapInstantiateWasmForPolyfill(finalOptions, channel);
	}

	loaderOptions.onPhpLoaderModuleLoaded?.(phpLoaderModule);

	return await loadPHPRuntime(phpLoaderModule, finalOptions);
}

interface WasmRefs {
	memory: WebAssembly.Memory | null;
	malloc: ((size: number) => number) | null;
}

function wrapInstantiateWasmForPolyfill(
	options: EmscriptenOptions,
	channel: SharedChannel
): EmscriptenOptions {
	const wasmRefs: WasmRefs = { memory: null, malloc: null };
	const originalInstantiateWasm = options.instantiateWasm;
	if (!originalInstantiateWasm) {
		// When Module['instantiateWasm'] is set, Emscripten
		// skips its default instantiation path entirely and
		// expects the hook to call receiveInstance(). Without
		// an original hook to delegate to, we cannot reliably
		// locate and fetch the WASM binary ourselves.
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
			patchAsyncImports(info, channel, wasmRefs);
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
	channel: SharedChannel,
	wasmRefs: WasmRefs
): void {
	const env = info['env'] as Record<string, unknown> | undefined;
	if (!env) return;

	if (typeof env['emscripten_sleep'] === 'function') {
		env['emscripten_sleep'] = (ms: number) => {
			sendRequestFromWorker(channel, REQUEST_SLEEP, [ms]);
		};
	}

	if (typeof env['emscripten_wget_data'] === 'function') {
		env['emscripten_wget_data'] = (
			urlPtr: number,
			pbuffer: number,
			pnum: number,
			perror: number
		) => {
			polyfillEmscriptenWgetData(
				channel,
				wasmRefs,
				urlPtr,
				pbuffer,
				pnum,
				perror
			);
		};
	}

	// wasm_recv / recv: route through SAB to main thread
	// where the real TCPOverFetchWebSocket can read data.
	// Both must be replaced — recv calls the original
	// _wasm_recv JS function, not the WASM import.
	const recvReplacement = (
		sockfd: number,
		buffer: number,
		size: number
	): number => {
		return polyfillRecv(channel, wasmRefs, sockfd, buffer, size);
	};
	if (typeof env['wasm_recv'] === 'function') {
		env['wasm_recv'] = recvReplacement;
	}
	if (typeof env['recv'] === 'function') {
		env['recv'] = recvReplacement;
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

	// js_module_onMessage: EM_ASYNC_JS function called by
	// post_message_to_js(). Returns a Promise in JSPI mode
	// which WASM can't suspend on with our polyfill. Replace
	// with a synchronous SAB-based version that routes the
	// message to the main thread for processing.
	// EM_ASYNC_JS adds the __asyncjs__ prefix to the name.
	if (typeof env['__asyncjs__js_module_onMessage'] === 'function') {
		env['__asyncjs__js_module_onMessage'] = (
			dataPtr: number,
			responseBufferPtr: number
		): number => {
			return polyfillJsModuleOnMessage(
				channel,
				wasmRefs,
				dataPtr,
				responseBufferPtr
			);
		};
	}
}

function polyfillEmscriptenWgetData(
	channel: SharedChannel,
	wasmRefs: WasmRefs,
	urlPtr: number,
	pbuffer: number,
	pnum: number,
	perror: number
): void {
	// Read null-terminated UTF-8 URL from WASM memory.
	const mem = new Uint8Array(wasmRefs.memory!.buffer);
	let end = urlPtr;
	while (mem[end] !== 0) end++;
	const urlBytes = mem.slice(urlPtr, end);

	// Send to main thread for fetching.
	const response = sendRequestFromWorker(
		channel,
		REQUEST_FETCH_URL,
		[],
		urlBytes
	);

	if (response.error !== 0) {
		const view = new DataView(wasmRefs.memory!.buffer);
		view.setInt32(pbuffer, 0, true);
		view.setInt32(pnum, 0, true);
		view.setInt32(perror, 1, true);
		return;
	}

	// Response layout: [4-byte total length (LE u32)] [first chunk]
	const totalLength = new DataView(
		response.data.buffer,
		response.data.byteOffset,
		4
	).getUint32(0, true);
	const chunks: Uint8Array[] = [];
	const firstChunk = response.data.subarray(4);
	chunks.push(firstChunk);
	let received = firstChunk.length;

	// Fetch remaining chunks if the response is larger
	// than what fits in a single SAB transfer.
	while (received < totalLength) {
		const chunkResponse = sendRequestFromWorker(
			channel,
			REQUEST_FETCH_URL_CHUNK,
			[received]
		);
		if (chunkResponse.error !== 0) break;
		chunks.push(chunkResponse.data);
		received += chunkResponse.data.length;
	}

	// Allocate WASM buffer via malloc.
	const ptr = wasmRefs.malloc!(totalLength);

	// Re-read memory.buffer after malloc — memory growth
	// can detach the old ArrayBuffer.
	const newMem = new Uint8Array(wasmRefs.memory!.buffer);
	let offset = 0;
	for (const chunk of chunks) {
		newMem.set(chunk, ptr + offset);
		offset += chunk.length;
	}

	// Write output pointers.
	const view = new DataView(wasmRefs.memory!.buffer);
	view.setInt32(pbuffer, ptr, true);
	view.setInt32(pnum, totalLength, true);
	view.setInt32(perror, 0, true);
}

function polyfillRecv(
	channel: SharedChannel,
	wasmRefs: WasmRefs,
	sockfd: number,
	buffer: number,
	size: number
): number {
	const socketId = PolyfillProxyWebSocket.sockfdToSocketId.get(sockfd);
	if (socketId === undefined) return 0;

	const response = sendRequestFromWorker(channel, REQUEST_SOCKET_RECV, [
		socketId,
		size,
	]);
	if (response.error !== 0 || response.responseLength === 0) return 0;

	const mem = new Uint8Array(wasmRefs.memory!.buffer);
	mem.set(response.data.subarray(0, response.responseLength), buffer);
	return response.responseLength;
}

/**
 * Synchronous SAB replacement for js_module_onMessage
 * (the EM_ASYNC_JS function behind post_message_to_js).
 *
 * Sends the message string to the main thread, receives
 * the response bytes, allocates a WASM buffer via malloc,
 * writes the pointer into response_buffer, and returns
 * the response size (or -1 on error).
 */
function polyfillJsModuleOnMessage(
	channel: SharedChannel,
	wasmRefs: WasmRefs,
	dataPtr: number,
	responseBufferPtr: number
): number {
	// Read null-terminated UTF-8 message from WASM memory.
	const mem = new Uint8Array(wasmRefs.memory!.buffer);
	let end = dataPtr;
	while (mem[end] !== 0) end++;
	const messageBytes = mem.slice(dataPtr, end);

	// Send to main thread for processing.
	const response = sendRequestFromWorker(
		channel,
		REQUEST_MESSAGE,
		[],
		messageBytes
	);

	if (response.error !== 0) {
		return -1;
	}

	// Response layout: [4-byte total length (LE u32)] [chunks]
	const totalLength = new DataView(
		response.data.buffer,
		response.data.byteOffset,
		4
	).getUint32(0, true);

	if (totalLength === 0) {
		// Empty response — allocate 1 byte for the null
		// terminator so the C caller gets a valid pointer.
		const ptr = wasmRefs.malloc!(1);
		const emptyMem = new Uint8Array(wasmRefs.memory!.buffer);
		emptyMem[ptr] = 0;
		const view = new DataView(wasmRefs.memory!.buffer);
		view.setInt32(responseBufferPtr, ptr, true);
		return 0;
	}

	const chunks: Uint8Array[] = [];
	const firstChunk = response.data.subarray(4);
	chunks.push(firstChunk);
	let received = firstChunk.length;

	// Fetch remaining chunks for large responses.
	while (received < totalLength) {
		const chunkResponse = sendRequestFromWorker(
			channel,
			REQUEST_FETCH_URL_CHUNK,
			[received]
		);
		if (chunkResponse.error !== 0) break;
		chunks.push(chunkResponse.data);
		received += chunkResponse.data.length;
	}

	// Allocate WASM buffer via malloc (+1 for null terminator).
	const ptr = wasmRefs.malloc!(totalLength + 1);

	// Re-read memory.buffer after malloc — memory growth
	// can detach the old ArrayBuffer.
	const newMem = new Uint8Array(wasmRefs.memory!.buffer);
	let offset = 0;
	for (const chunk of chunks) {
		newMem.set(chunk, ptr + offset);
		offset += chunk.length;
	}
	newMem[ptr + totalLength] = 0;

	// Write pointer to response_buffer (4 bytes LE).
	const view = new DataView(wasmRefs.memory!.buffer);
	view.setInt32(responseBufferPtr, ptr, true);

	return totalLength;
}
