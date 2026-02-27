/**
 * SharedArrayBuffer-based communication channel for the
 * JSPI polyfill. Used by both the worker side (PHP WASM
 * thread) and the main-thread side to exchange synchronous
 * requests and responses.
 *
 * Buffer layout:
 *
 *   Offset  Size  Field
 *   0       4     status (0=idle, 1=request, 2=response)
 *   4       4     requestType (operation type enum)
 *   8       4     responseError (0=ok, nonzero=error)
 *   12      4     responseLength (response data bytes)
 *   16      4     i32 param slot 0
 *   20      4     i32 param slot 1
 *   24      4     i32 param slot 2
 *   28      4     i32 param slot 3
 *   32      4     requestDataLength (request data bytes)
 *   36      N     data payload (variable length)
 */

// --- Constants ---

export const REQUEST_SLEEP = 1;
export const REQUEST_FETCH_URL = 2;
export const REQUEST_FETCH_URL_CHUNK = 3;
export const REQUEST_SOCKET_OPEN = 4;
export const REQUEST_SOCKET_SEND = 5;
export const REQUEST_SOCKET_RECV = 6;
export const REQUEST_SOCKET_CLOSE = 7;
export const HEADER_SIZE = 36;
export const DEFAULT_DATA_SIZE = 1024 * 1024;

// Header field offsets (Int32Array indices, not byte offsets)
const STATUS = 0;
const REQUEST_TYPE = 1;
const RESPONSE_ERROR = 2;
const RESPONSE_LENGTH = 3;
const PARAM_0 = 4;
const PARAM_1 = 5;
const PARAM_2 = 6;
const PARAM_3 = 7;
const REQUEST_DATA_LENGTH = 8;

const PARAM_INDICES = [PARAM_0, PARAM_1, PARAM_2, PARAM_3];

// Status values
const STATUS_IDLE = 0;
const STATUS_REQUEST = 1;
const STATUS_RESPONSE = 2;

// --- Types ---

export interface SharedChannel {
	sab: SharedArrayBuffer;
	int32View: Int32Array;
	dataView: Uint8Array;
}

export interface WorkerResponse {
	error: number;
	responseLength: number;
	data: Uint8Array;
}

export interface MainThreadRequest {
	requestType: number;
	params: [number, number, number, number];
	data: Uint8Array;
}

// --- Public API ---

/**
 * Creates a SharedArrayBuffer with the header + data region.
 */
export function createSharedChannel(
	dataSize: number = DEFAULT_DATA_SIZE
): SharedChannel {
	const sab = new SharedArrayBuffer(HEADER_SIZE + dataSize);
	return wrapSharedChannel(sab);
}

/**
 * Worker side: sends a request and blocks until the main
 * thread responds. Writes request type, up to 4 i32 params,
 * and optional data bytes into the channel, then sets
 * status=request and calls Atomics.wait() to block.
 *
 * Returns the response error code, length, and data bytes.
 */
export function sendRequestFromWorker(
	channel: SharedChannel,
	requestType: number,
	params: number[],
	dataBytes?: Uint8Array
): WorkerResponse {
	const { int32View, dataView } = channel;

	Atomics.store(int32View, REQUEST_TYPE, requestType);

	for (let i = 0; i < PARAM_INDICES.length; i++) {
		Atomics.store(int32View, PARAM_INDICES[i], params[i] ?? 0);
	}

	if (dataBytes && dataBytes.length > 0) {
		dataView.set(dataBytes);
		Atomics.store(int32View, REQUEST_DATA_LENGTH, dataBytes.length);
	} else {
		Atomics.store(int32View, REQUEST_DATA_LENGTH, 0);
	}

	// Signal the main thread that a request is ready.
	Atomics.store(int32View, STATUS, STATUS_REQUEST);
	Atomics.notify(int32View, STATUS);

	// Block until the main thread writes a response.
	Atomics.wait(int32View, STATUS, STATUS_REQUEST);

	const error = Atomics.load(int32View, RESPONSE_ERROR);
	const responseLength = Atomics.load(int32View, RESPONSE_LENGTH);
	// Copy the response data before resetting to idle,
	// since the shared memory region can be overwritten.
	const data = new Uint8Array(dataView.subarray(0, responseLength));

	// Reset to idle for the next request/response cycle.
	Atomics.store(int32View, STATUS, STATUS_IDLE);

	return { error, responseLength, data };
}

/**
 * Main thread side: reads the current request type, params,
 * and any data bytes from the channel.
 */
export function readRequest(channel: SharedChannel): MainThreadRequest {
	const { int32View, dataView } = channel;

	const requestType = Atomics.load(int32View, REQUEST_TYPE);
	const params: [number, number, number, number] = [
		Atomics.load(int32View, PARAM_0),
		Atomics.load(int32View, PARAM_1),
		Atomics.load(int32View, PARAM_2),
		Atomics.load(int32View, PARAM_3),
	];

	// Copy only the meaningful request data bytes.
	const dataLength = Atomics.load(int32View, REQUEST_DATA_LENGTH);
	const data = new Uint8Array(dataView.subarray(0, dataLength));

	return { requestType, params, data };
}

/**
 * Main thread side: writes error code and optional data
 * bytes, sets status=response, and notifies the worker.
 */
export function sendResponseToWorker(
	channel: SharedChannel,
	error: number,
	dataBytes?: Uint8Array
): void {
	const { int32View, dataView } = channel;

	Atomics.store(int32View, RESPONSE_ERROR, error);

	if (dataBytes && dataBytes.length > 0) {
		dataView.set(dataBytes);
		Atomics.store(int32View, RESPONSE_LENGTH, dataBytes.length);
	} else {
		Atomics.store(int32View, RESPONSE_LENGTH, 0);
	}

	Atomics.store(int32View, STATUS, STATUS_RESPONSE);
	Atomics.notify(int32View, STATUS);
}

/**
 * Main thread side: returns a Promise that resolves when
 * status changes from idle to request. Uses
 * Atomics.waitAsync if available, falls back to polling
 * with setInterval.
 *
 * This is a persistent listener: after each request is
 * handled (status returns to idle), it resumes waiting
 * for the next one.
 *
 * @param onRequest Called each time a request arrives.
 */
export function waitForRequestAsync(
	channel: SharedChannel,
	onRequest: () => void | Promise<void>
): { cancel: () => void } {
	let cancelled = false;

	const cancel = () => {
		cancelled = true;
	};

	if (hasAtomicsWaitAsync()) {
		waitWithAtomicsWaitAsync(channel, onRequest, () => cancelled);
	} else {
		waitWithPolling(channel, onRequest, () => cancelled);
	}

	return { cancel };
}

// --- Helpers ---

/**
 * Wraps a raw SharedArrayBuffer into a SharedChannel.
 * Useful when a worker receives a SAB from the main thread
 * and needs to construct the typed views.
 */
export function wrapSharedChannel(sab: SharedArrayBuffer): SharedChannel {
	const int32View = new Int32Array(sab, 0, HEADER_SIZE / 4);
	const dataView = new Uint8Array(sab, HEADER_SIZE);
	return { sab, int32View, dataView };
}

function hasAtomicsWaitAsync(): boolean {
	return (
		typeof Atomics !== 'undefined' &&
		'waitAsync' in Atomics &&
		typeof Atomics.waitAsync === 'function'
	);
}

async function waitWithAtomicsWaitAsync(
	channel: SharedChannel,
	onRequest: () => void | Promise<void>,
	isCancelled: () => boolean
): Promise<void> {
	if (isCancelled()) return;

	const status = Atomics.load(channel.int32View, STATUS);
	if (status === STATUS_REQUEST) {
		await onRequest();
		// After the handler runs, schedule next wait.
		waitWithAtomicsWaitAsync(channel, onRequest, isCancelled);
		return;
	}

	const result = Atomics.waitAsync(channel.int32View, STATUS, STATUS_IDLE);

	if (result.async) {
		result.value.then(() => {
			if (isCancelled()) return;
			waitWithAtomicsWaitAsync(channel, onRequest, isCancelled);
		});
	} else {
		// Value changed synchronously (not-equal). Use
		// queueMicrotask to prevent unbounded stack growth.
		if (isCancelled()) return;
		queueMicrotask(() => {
			waitWithAtomicsWaitAsync(channel, onRequest, isCancelled);
		});
	}
}

function waitWithPolling(
	channel: SharedChannel,
	onRequest: () => void | Promise<void>,
	isCancelled: () => boolean
): void {
	const interval = setInterval(async () => {
		if (isCancelled()) {
			clearInterval(interval);
			return;
		}

		const status = Atomics.load(channel.int32View, STATUS);
		if (status === STATUS_REQUEST) {
			await onRequest();
		}
	}, 1);
}
