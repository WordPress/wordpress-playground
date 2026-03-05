/**
 * Service worker handler for JSPI polyfill requests.
 *
 * The worker sends synchronous XHR POSTs to `/_jspi/<op>`
 * endpoints. This module handles those requests in the
 * service worker's fetch event, performs async work, and
 * returns a Response. The sync XHR blocks until the
 * response arrives — no SharedArrayBuffer needed.
 */

import type { TCPOverFetchOptions } from '../tcp-over-fetch-websocket';
import { isURLScoped } from '@php-wasm/scopes';
import { MainThreadSocketManager } from './main-thread-socket-manager';

const JSPI_PATH_PREFIX = '/_jspi/';
const FETCH_TIMEOUT_MS = 20_000;

let socketManager: MainThreadSocketManager | null = null;
let corsProxyUrl: string | undefined;

/**
 * Stores TCP-over-fetch options and creates the socket
 * manager. Call once when the service worker receives
 * the `jspi-polyfill-options` message from the main
 * thread.
 */
export function initJspiHandler(
	tcpOverFetchOptions?: TCPOverFetchOptions
): void {
	if (tcpOverFetchOptions) {
		// Close any sockets from a previous runtime instance
		// to prevent resource leaks during runtime rotation.
		socketManager?.closeAll();
		socketManager = new MainThreadSocketManager(tcpOverFetchOptions);
		corsProxyUrl = tcpOverFetchOptions.corsProxyUrl;
	}
}

/**
 * Returns `true` if the URL is a JSPI polyfill request
 * that should be handled by `handleJspiRequest`.
 */
export function isJspiRequest(url: URL): boolean {
	return url.pathname.startsWith(JSPI_PATH_PREFIX);
}

/**
 * Dispatches a JSPI polyfill request to the appropriate
 * operation handler and returns a Response.
 */
export async function handleJspiRequest(
	url: URL,
	request: Request
): Promise<Response> {
	const op = url.pathname.slice(JSPI_PATH_PREFIX.length);
	const params = url.searchParams;

	try {
		switch (op) {
			case 'sleep':
				return await handleSleep(params);
			case 'fetch':
				return await handleFetch(request);
			case 'msg':
				return await handleMessage(request);
			case 'sock-open':
				return handleSocketOpen(params);
			case 'sock-send':
				return await handleSocketSend(params, request);
			case 'sock-recv':
				return await handleSocketRecv(params);
			case 'sock-close':
				return handleSocketClose(params);
			default:
				return new Response(null, { status: 404 });
		}
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error('[JSPI SW handler] error:', err);
		return new Response(null, { status: 500 });
	}
}

async function handleSleep(params: URLSearchParams): Promise<Response> {
	const ms = parseInt(params.get('ms') ?? '0', 10);
	await new Promise<void>((resolve) => setTimeout(resolve, ms));
	return new Response(null, { status: 200 });
}

/**
 * Handles emscripten_wget_data: fetches the URL sent in
 * the request body and returns the raw response bytes.
 */
async function handleFetch(request: Request): Promise<Response> {
	const urlBytes = new Uint8Array(await request.arrayBuffer());
	const url = new TextDecoder().decode(urlBytes);

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetchSafe(url, {
			signal: controller.signal,
		});
		const body = await response.arrayBuffer();
		return new Response(body, { status: 200 });
	} catch {
		return new Response(null, { status: 502 });
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Handles a post_message_to_js() call forwarded from the
 * worker. Parses the JSON envelope, and if it's a network
 * request, performs the fetch and returns raw HTTP bytes.
 */
async function handleMessage(request: Request): Promise<Response> {
	const messageStr = new TextDecoder().decode(
		new Uint8Array(await request.arrayBuffer())
	);

	let envelope: { type: string; data?: RequestData };
	try {
		envelope = JSON.parse(messageStr);
	} catch {
		return new Response(null, { status: 200 });
	}

	if (envelope.type !== 'request' || !envelope.data) {
		return new Response(null, { status: 200 });
	}

	const body = await fetchAsRawHttp(envelope.data);
	return new Response(body, { status: 200 });
}

interface RequestData {
	url: string;
	method?: string;
	headers?: Record<string, string> | string[];
	data?: string;
	blocking?: boolean;
}

/**
 * Performs a fetch and formats the result as raw HTTP bytes
 * (status line + headers + body), matching the format
 * expected by WordPress's Wp_Http_Fetch transport.
 */
async function fetchAsRawHttp(data: RequestData): Promise<Uint8Array> {
	// Fire-and-forget: return an immediate empty 200 without
	// waiting for the response (matches WP_Http `blocking=false`).
	if (data.blocking === false) {
		fetchSafe(data.url, { method: data.method || 'GET' }).catch(() => {});
		return new TextEncoder().encode('HTTP/1.1 200 OK\r\n\r\n');
	}

	const errorResponse = new TextEncoder().encode(
		'HTTP/1.1 502 Bad Gateway\r\n' +
			'content-type: text/plain\r\n\r\n' +
			'Playground could not serve the request.'
	);

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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

		const response = await fetchSafe(data.url, {
			method,
			headers,
			body: method === 'GET' ? undefined : data.data,
			credentials: 'omit' as RequestCredentials,
			signal: controller.signal,
		});

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
 * Fetches a URL with loopback detection, referrer clearing,
 * http→https upgrade, and optional CORS proxy fallback.
 */
async function fetchSafe(url: string, init: RequestInit): Promise<Response> {
	// Reject scoped URLs — they would route back to the
	// blocked PHP worker and deadlock.
	if (isURLScoped(new URL(url))) {
		throw new Error('Cannot fetch scoped URL from polyfill handler');
	}

	// Clear referrer to avoid service worker routing loops.
	init = { ...init, referrer: '' };

	// Upgrade http to https, except for localhost.
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

function getSocketParams(params: URLSearchParams): {
	manager: MainThreadSocketManager;
	socketId: number;
} {
	if (!socketManager) {
		throw new Error('Socket manager not initialized');
	}
	return {
		manager: socketManager,
		socketId: parseInt(params.get('socketId') ?? '0', 10),
	};
}

function handleSocketOpen(params: URLSearchParams): Response {
	const { manager, socketId } = getSocketParams(params);
	const host = params.get('host') ?? '';
	const port = parseInt(params.get('port') ?? '0', 10);
	manager.createSocket(socketId, host, port);
	return new Response(null, { status: 200 });
}

async function handleSocketSend(
	params: URLSearchParams,
	request: Request
): Promise<Response> {
	const { manager, socketId } = getSocketParams(params);
	const data = new Uint8Array(await request.arrayBuffer());
	manager.sendToSocket(socketId, data);
	return new Response(null, { status: 200 });
}

async function handleSocketRecv(params: URLSearchParams): Promise<Response> {
	const { manager, socketId } = getSocketParams(params);
	const maxSize = parseInt(params.get('maxSize') ?? '65536', 10);
	const data = await manager.recvFromSocket(socketId, maxSize);
	return new Response(data, { status: 200 });
}

function handleSocketClose(params: URLSearchParams): Response {
	const { manager, socketId } = getSocketParams(params);
	manager.closeSocket(socketId);
	return new Response(null, { status: 200 });
}
