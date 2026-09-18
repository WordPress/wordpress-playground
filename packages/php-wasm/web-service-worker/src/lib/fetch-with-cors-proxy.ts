import { cloneRequest, supportsReadableStreamBody } from './utils';
import { FirewallInterferenceError } from './firewall-interference-error';

const CORS_PROXY_HEADER = 'X-Playground-Cors-Proxy';
const CORS_ENABLED_HOST_REQUEST_HEADERS = new Map([
	[
		'api.anthropic.com',
		{
			'anthropic-dangerous-direct-browser-access': 'true',
		},
	],
	['api.openai.com', {}],
	['generativelanguage.googleapis.com', {}],
]);

export async function fetchWithCorsProxy(
	input: RequestInfo,
	init?: RequestInit,
	corsProxyUrl?: string,
	playgroundUrl?: string
): Promise<Response> {
	let requestObject =
		typeof input === 'string' ? new Request(input, init) : input;
	const playgroundUrlObj = playgroundUrl ? new URL(playgroundUrl) : null;
	let requestUrlObj = playgroundUrlObj
		? new URL(requestObject.url, playgroundUrlObj)
		: new URL(requestObject.url);

	if (isLocalhost(requestUrlObj)) {
		return await fetch(requestObject);
	}

	if (isKnownCorsEnabledHost(requestUrlObj)) {
		requestObject = await addCorsEnabledHostRequestHeaders(
			requestObject,
			requestUrlObj
		);
		return await fetch(requestObject);
	}

	if (requestUrlObj.protocol === 'http:') {
		requestUrlObj.protocol = 'https:';
		const httpsUrl = requestUrlObj.toString();
		requestObject = await cloneRequest(requestObject, { url: httpsUrl });
		requestUrlObj = new URL(httpsUrl);
	}
	if (!corsProxyUrl) {
		return await fetch(requestObject);
	}

	/**
	 * Never try to proxy requests to the playground itself. The remote proxy
	 * won't be able to reach it. At best, it will produce a cryptic error
	 * message. At worst, it will time out, making the user wait for 30 seconds.
	 */
	if (
		playgroundUrlObj &&
		requestUrlObj.protocol === playgroundUrlObj.protocol &&
		requestUrlObj.hostname === playgroundUrlObj.hostname &&
		requestUrlObj.port === playgroundUrlObj.port &&
		requestUrlObj.pathname.startsWith(playgroundUrlObj.pathname)
	) {
		return await fetch(requestObject);
	}

	// Clone before the first fetch so the body is preserved for a potential
	// CORS-proxy retry. request.clone() works cross-browser — including
	// Firefox (where request.body is undefined) and Safari (where passing
	// a ReadableStream body to fetch() throws).
	const clonedRequest = requestObject.clone();

	try {
		return await fetch(requestObject);
	} catch {
		// If the developer has explicitly allowed the request to pass the
		// credentials headers with the X-Cors-Proxy-Allowed-Request-Headers header,
		// then let's include those credentials in the fetch() request.
		const headers = new Headers(requestObject.headers);
		const corsProxyAllowedHeaders =
			headers.get('x-cors-proxy-allowed-request-headers')?.split(',') ||
			[];
		const requestIntendsToPassCredentials =
			corsProxyAllowedHeaders.includes('authorization') ||
			corsProxyAllowedHeaders.includes('cookie');

		// Wrap multipart/form-data Content-Type to prevent the CORS
		// proxy's PHP from auto-parsing the body. PHP consumes
		// multipart/form-data bodies into $_POST/$_FILES, emptying
		// php://input and making it impossible for the proxy to
		// forward the raw body to the target server.
		const contentType = headers.get('content-type');
		if (
			contentType &&
			contentType.toLowerCase().includes('multipart/form-data')
		) {
			headers.set('x-cors-proxy-content-type', contentType);
			headers.set('content-type', 'application/octet-stream');
		}

		// Extract the body from the pre-fetch clone for the retry.
		// Chrome: pass the clone's ReadableStream directly (with duplex: 'half').
		// Safari/Firefox: use clonedRequest.arrayBuffer() which works cross-browser.
		// We cannot use `new Response(request.body).arrayBuffer()` because Firefox
		// does not expose request.body at all.
		let body: ArrayBuffer | ReadableStream<Uint8Array> | null = null;
		const method = requestObject.method.toUpperCase();
		if (method !== 'GET' && method !== 'HEAD') {
			if (await supportsReadableStreamBody()) {
				body = clonedRequest.body;
			} else {
				body = await clonedRequest.arrayBuffer();
			}
		}

		/**
		 * When using streaming bodies, buffer into an ArrayBuffer if the
		 * CORS proxy uses `http:`. Streaming request bodies cause Chrome
		 * to silently upgrade HTTP/1.1 to HTTP/2, but an HTTP/1.1-only
		 * server replies with HTTP/1.1, triggering ERR_ALPN_NEGOTIATION_FAILED.
		 *
		 * Inferring the HTTP version from the URL protocol is unreliable
		 * and will fail if the CORS proxy is hosted on a `https://` URL
		 * that speaks HTTP < 2. This is a recognized limitation of the CORS
		 * proxy feature. If you host it on an `https://` URL, make sure
		 * to use HTTP/2.
		 *
		 * @see https://developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests
		 */
		if (
			body instanceof ReadableStream &&
			new URL(corsProxyUrl, import.meta.url).protocol === 'http:'
		) {
			body = await new Response(body).arrayBuffer();
		}

		const newRequest = await cloneRequest(requestObject, {
			url: `${corsProxyUrl}${requestObject.url}`,
			headers,
			body,
			...(requestIntendsToPassCredentials && { credentials: 'include' }),
		});

		const response = await fetch(newRequest);

		// Check for firewall interference: if we got a response but it's
		// missing the CORS proxy identification header, the response likely
		// came from a network firewall rather than the actual CORS proxy.
		if (!response.headers.has(CORS_PROXY_HEADER)) {
			throw new FirewallInterferenceError(
				requestObject.url,
				response.status,
				response.statusText
			);
		}

		return response;
	}
}

function isLocalhost(url: URL) {
	return (
		url.hostname === 'localhost' ||
		url.hostname === '127.0.0.1' ||
		url.hostname === '[::1]' ||
		url.hostname === '::1'
	);
}

function isKnownCorsEnabledHost(url: URL) {
	return (
		url.protocol === 'https:' &&
		CORS_ENABLED_HOST_REQUEST_HEADERS.has(url.hostname)
	);
}

async function addCorsEnabledHostRequestHeaders(
	request: Request,
	url: URL
): Promise<Request> {
	const headersToAdd = CORS_ENABLED_HOST_REQUEST_HEADERS.get(url.hostname);
	if (!headersToAdd) {
		return request;
	}

	const headers = new Headers(request.headers);
	for (const [name, value] of Object.entries(headersToAdd)) {
		if (!headers.has(name)) {
			headers.set(name, value);
		}
	}

	return await cloneRequest(request, {
		headers,
	});
}
