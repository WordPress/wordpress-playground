/**
 * Main-thread async request handler for the JSPI polyfill.
 *
 * Listens for requests from the worker via the
 * SharedArrayBuffer channel, dispatches to the appropriate
 * handler based on requestType, performs the async
 * operation, and sends the response back.
 */

import type { TCPOverFetchOptions } from '../tcp-over-fetch-websocket';
import { MainThreadSocketManager } from './main-thread-socket-manager';
import type { SharedChannel, MainThreadRequest } from './shared-channel';
import {
	readRequest,
	sendResponseToWorker,
	waitForRequestAsync,
	REQUEST_SLEEP,
	REQUEST_FETCH_URL,
	REQUEST_FETCH_URL_CHUNK,
	REQUEST_SOCKET_OPEN,
	REQUEST_SOCKET_SEND,
	REQUEST_SOCKET_RECV,
	REQUEST_SOCKET_CLOSE,
	REQUEST_MESSAGE,
} from './shared-channel';

/**
 * Starts listening for requests on the given channel.
 * Returns a handle with a `cancel()` method to stop
 * listening.
 */
export function startMainThreadHandler(
	channel: SharedChannel,
	tcpOverFetchOptions?: TCPOverFetchOptions
): {
	cancel: () => void;
} {
	let storedFetchResponse: Uint8Array | null = null;
	const socketManager = tcpOverFetchOptions
		? new MainThreadSocketManager(tcpOverFetchOptions)
		: null;

	return waitForRequestAsync(channel, async () => {
		try {
			const request = readRequest(channel);
			// eslint-disable-next-line no-console
			const debugLabel = `[JSPI] req=${request.requestType}`;
			// eslint-disable-next-line no-console
			console.log(debugLabel, 'start');
			const t0 = performance.now();
			switch (request.requestType) {
				case REQUEST_SLEEP:
					await handleSleep(request.params[0]);
					sendResponseToWorker(channel, 0);
					break;
				case REQUEST_FETCH_URL:
					storedFetchResponse = await handleFetchUrl(
						channel,
						request
					);
					break;
				case REQUEST_FETCH_URL_CHUNK:
					handleFetchUrlChunk(channel, request, storedFetchResponse);
					break;
				case REQUEST_SOCKET_OPEN:
					handleSocketOpen(channel, request, socketManager);
					break;
				case REQUEST_SOCKET_SEND:
					handleSocketSend(channel, request, socketManager);
					break;
				case REQUEST_SOCKET_RECV:
					await handleSocketRecv(channel, request, socketManager);
					break;
				case REQUEST_SOCKET_CLOSE:
					handleSocketClose(channel, request, socketManager);
					break;
				case REQUEST_MESSAGE:
					storedFetchResponse = await handleMessage(
						channel,
						request,
						tcpOverFetchOptions?.corsProxyUrl
					);
					break;
				default:
					// Unknown request type — respond with error.
					sendResponseToWorker(channel, 1);
					break;
			}
			// eslint-disable-next-line no-console
			console.log(
				debugLabel,
				`done ${Math.round(performance.now() - t0)}ms`
			);
		} catch (err) {
			// Always unblock the worker. Without this,
			// an uncaught exception leaves the worker
			// stuck on Atomics.wait() permanently.
			// eslint-disable-next-line no-console
			console.error('[JSPI polyfill] handler error:', err);
			try {
				sendResponseToWorker(channel, 1);
			} catch {
				// Nothing we can do if even the error
				// response write fails.
			}
		}
	});
}

async function handleSleep(ms: number): Promise<void> {
	await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches the URL, stores the full response body, and sends
 * the first chunk back with a 4-byte total-length prefix.
 * Returns the stored response for subsequent chunk requests.
 */
async function handleFetchUrl(
	channel: SharedChannel,
	request: MainThreadRequest
): Promise<Uint8Array | null> {
	const url = new TextDecoder().decode(request.data);
	let body: Uint8Array;
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 20_000);
		try {
			// Clear referrer so the service worker doesn't
			// route this fetch back to the blocked PHP worker
			// (its referrer-based scope check would deadlock).
			const response = await fetch(url, {
				referrer: '',
				signal: controller.signal,
			});
			body = new Uint8Array(await response.arrayBuffer());
		} finally {
			clearTimeout(timer);
		}
	} catch {
		sendResponseToWorker(channel, 1);
		return null;
	}

	const maxChunk = channel.dataView.byteLength - 4;
	const chunkSize = Math.min(body.length, maxChunk);
	const responseData = new Uint8Array(4 + chunkSize);
	new DataView(responseData.buffer).setUint32(0, body.length, true);
	responseData.set(body.subarray(0, chunkSize), 4);
	sendResponseToWorker(channel, 0, responseData);

	return body;
}

/**
 * Sends the next chunk of the stored fetch response at
 * the requested offset.
 */
function handleFetchUrlChunk(
	channel: SharedChannel,
	request: MainThreadRequest,
	storedFetchResponse: Uint8Array | null
): void {
	const offset = request.params[0];
	if (!storedFetchResponse || offset >= storedFetchResponse.length) {
		sendResponseToWorker(channel, 1);
		return;
	}

	const maxChunk = channel.dataView.byteLength;
	const remaining = storedFetchResponse.length - offset;
	const chunkSize = Math.min(remaining, maxChunk);
	sendResponseToWorker(
		channel,
		0,
		storedFetchResponse.subarray(offset, offset + chunkSize)
	);
}

/**
 * Handles a post_message_to_js() call forwarded from the
 * worker. Parses the JSON envelope, and if it's a network
 * request, performs the fetch and returns raw HTTP bytes.
 *
 * Uses the same chunked response protocol as handleFetchUrl
 * so large responses are transferred in multiple SAB chunks.
 */
async function handleMessage(
	channel: SharedChannel,
	request: MainThreadRequest,
	corsProxyUrl?: string
): Promise<Uint8Array | null> {
	const messageStr = new TextDecoder().decode(request.data);

	let envelope: { type: string; data?: RequestData };
	try {
		envelope = JSON.parse(messageStr);
	} catch {
		// Not valid JSON — return empty response.
		sendEmptyChunkedResponse(channel);
		return null;
	}

	if (envelope.type !== 'request' || !envelope.data) {
		// eslint-disable-next-line no-console
		console.log('[JSPI] MESSAGE non-request:', envelope.type);
		sendEmptyChunkedResponse(channel);
		return null;
	}

	// eslint-disable-next-line no-console
	console.log(
		'[JSPI] MESSAGE fetch:',
		envelope.data.method || 'GET',
		envelope.data.url?.substring(0, 120)
	);
	const body = await fetchAsRawHttp(envelope.data, corsProxyUrl);
	// eslint-disable-next-line no-console
	console.log('[JSPI] MESSAGE response:', body.length, 'bytes');

	const maxChunk = channel.dataView.byteLength - 4;
	const chunkSize = Math.min(body.length, maxChunk);
	const responseData = new Uint8Array(4 + chunkSize);
	new DataView(responseData.buffer).setUint32(0, body.length, true);
	responseData.set(body.subarray(0, chunkSize), 4);
	sendResponseToWorker(channel, 0, responseData);

	return body;
}

interface RequestData {
	url: string;
	method?: string;
	headers?: Record<string, string> | string[];
	data?: string;
}

/**
 * Performs a fetch and formats the result as raw HTTP bytes
 * (status line + headers + body), matching the format
 * expected by WordPress's Wp_Http_Fetch transport.
 *
 * The 20-second abort timeout covers the entire cycle:
 * DNS + connect + headers + body read. This prevents a
 * stalled response stream (e.g. from the CORS proxy)
 * from blocking the SAB handler permanently.
 */
async function fetchAsRawHttp(
	data: RequestData,
	corsProxyUrl?: string
): Promise<Uint8Array> {
	const errorResponse = new TextEncoder().encode(
		'HTTP/1.1 400 Invalid Request\r\n' +
			'content-type: text/plain\r\n\r\n' +
			'Playground could not serve the request.'
	);

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 20_000);

	try {
		const method = data.method || 'GET';
		let headers: Record<string, string> = {};
		if (data.headers && !Array.isArray(data.headers)) {
			headers = data.headers;
		} else if (Array.isArray(data.headers)) {
			headers = Object.fromEntries(
				data.headers.map((h) => {
					const idx = h.indexOf(':');
					return [h.slice(0, idx).trim(), h.slice(idx + 1).trim()];
				})
			);
		}

		const hasContentType = Object.keys(headers).some(
			(k) => k.toLowerCase() === 'content-type'
		);
		if (method === 'POST' && !hasContentType) {
			headers['Content-Type'] = 'application/x-www-form-urlencoded';
		}

		const response = await fetchWithCorsProxy(
			data.url,
			{
				method,
				headers,
				body: method === 'GET' ? undefined : data.data,
				credentials: 'omit' as RequestCredentials,
				signal: controller.signal,
			},
			corsProxyUrl
		);

		const responseHeaders: string[] = [];
		response.headers.forEach((value, key) => {
			responseHeaders.push(key + ': ' + value);
		});

		const headersText =
			[
				'HTTP/1.1 ' + response.status + ' ' + response.statusText,
				...responseHeaders,
			].join('\r\n') + '\r\n\r\n';

		const headersBuffer = new TextEncoder().encode(headersText);
		const bodyBuffer = new Uint8Array(await response.arrayBuffer());
		const jointBuffer = new Uint8Array(
			headersBuffer.byteLength + bodyBuffer.byteLength
		);
		jointBuffer.set(headersBuffer);
		jointBuffer.set(bodyBuffer, headersBuffer.byteLength);

		return jointBuffer;
	} catch {
		return errorResponse;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Simplified CORS proxy fetch: try direct fetch first,
 * fall back to CORS proxy URL prefix if available.
 *
 * Callers must provide their own AbortSignal via init
 * to cover the full fetch+body-read cycle.
 */
async function fetchWithCorsProxy(
	url: string,
	init: RequestInit,
	corsProxyUrl?: string
): Promise<Response> {
	// Scoped URLs (containing /scope:XXX/) are served by the
	// service worker, which forwards them to the PHP worker.
	// But the PHP worker is blocked on Atomics.wait() waiting
	// for THIS handler to respond — fetching a scoped URL
	// would deadlock. Fail immediately so WordPress can handle
	// the error (e.g. wp-cron failures are non-fatal).
	if (/\/scope:[^/]+\//.test(url)) {
		throw new Error('Cannot fetch scoped URL from polyfill handler');
	}

	// Clear referrer so the service worker doesn't
	// route this fetch back to the blocked PHP worker
	// (its referrer-based scope check would deadlock).
	init = { ...init, referrer: '' };

	// Upgrade http to https, but not for localhost —
	// the dev server doesn't have TLS.
	let fetchUrl = url;
	if (fetchUrl.startsWith('http:') && !isLocalhostUrl(fetchUrl)) {
		fetchUrl = 'https:' + fetchUrl.slice(5);
	}

	if (!corsProxyUrl) {
		return await fetch(fetchUrl, init);
	}

	try {
		return await fetch(fetchUrl, init);
	} catch {
		return await fetch(corsProxyUrl + fetchUrl, init);
	}
}

function isLocalhostUrl(url: string): boolean {
	try {
		const { hostname } = new URL(url);
		return (
			hostname === 'localhost' ||
			hostname === '127.0.0.1' ||
			hostname === '[::1]'
		);
	} catch {
		return false;
	}
}

function sendEmptyChunkedResponse(channel: SharedChannel): void {
	const responseData = new Uint8Array(4);
	new DataView(responseData.buffer).setUint32(0, 0, true);
	sendResponseToWorker(channel, 0, responseData);
}

function handleSocketOpen(
	channel: SharedChannel,
	request: MainThreadRequest,
	socketManager: MainThreadSocketManager | null
): void {
	if (!socketManager) {
		sendResponseToWorker(channel, 1);
		return;
	}
	const socketId = request.params[0];
	const port = request.params[1];
	const host = new TextDecoder().decode(request.data);
	socketManager.createSocket(socketId, host, port);
	sendResponseToWorker(channel, 0);
}

function handleSocketSend(
	channel: SharedChannel,
	request: MainThreadRequest,
	socketManager: MainThreadSocketManager | null
): void {
	if (!socketManager) {
		sendResponseToWorker(channel, 1);
		return;
	}
	const socketId = request.params[0];
	socketManager.sendToSocket(socketId, request.data);
	sendResponseToWorker(channel, 0);
}

async function handleSocketRecv(
	channel: SharedChannel,
	request: MainThreadRequest,
	socketManager: MainThreadSocketManager | null
): Promise<void> {
	if (!socketManager) {
		sendResponseToWorker(channel, 1);
		return;
	}
	const socketId = request.params[0];
	const maxSize = request.params[1];
	const data = await socketManager.recvFromSocket(socketId, maxSize);
	sendResponseToWorker(channel, 0, data);
}

function handleSocketClose(
	channel: SharedChannel,
	request: MainThreadRequest,
	socketManager: MainThreadSocketManager | null
): void {
	if (!socketManager) {
		sendResponseToWorker(channel, 1);
		return;
	}
	const socketId = request.params[0];
	socketManager.closeSocket(socketId);
	sendResponseToWorker(channel, 0);
}
