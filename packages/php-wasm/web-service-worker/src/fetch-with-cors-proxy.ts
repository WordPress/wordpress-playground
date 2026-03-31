import { cloneRequest, teeRequest } from './utils';
import { FirewallInterferenceError } from './firewall-interference-error';

const CORS_PROXY_HEADER = 'X-Playground-Cors-Proxy';

let streamBodySupported: boolean | undefined;
async function supportsReadableStreamBody(): Promise<boolean> {
	if (streamBodySupported !== undefined) {
		return streamBodySupported;
	}
	try {
		const stream = new ReadableStream({
			start(controller) {
				controller.close();
			},
		});
		await fetch('data:a/a,', {
			method: 'POST',
			body: stream,
			duplex: 'half',
		} as RequestInit);
		streamBodySupported = true;
	} catch {
		streamBodySupported = false;
	}
	return streamBodySupported;
}

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

	/**
	 * Never proxy localhost requests. The remote proxy cannot reach the user's
	 * localhost, so we must fetch directly to access local APIs.
	 */
	const isLocalhost =
		requestUrlObj.hostname === 'localhost' ||
		requestUrlObj.hostname === '127.0.0.1' ||
		requestUrlObj.hostname === '[::1]' ||
		requestUrlObj.hostname === '::1';
	if (isLocalhost) {
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

	const useStreaming = await supportsReadableStreamBody();

	let directRequest: Request;
	let corsProxyBody: ArrayBuffer | ReadableStream<Uint8Array> | null;

	if (useStreaming) {
		const [teedDirect, teedProxy] = await teeRequest(requestObject);
		directRequest = teedDirect;
		corsProxyBody = teedProxy.body;
	} else {
		/**
		 * Buffer the request body so it can be reused across the direct
		 * fetch attempt and the CORS proxy fallback. Safari does not
		 * support ReadableStream as a fetch() request body
		 * ("ReadableStream uploading is not supported").
		 */
		let bufferedBody: ArrayBuffer | null = null;
		if (requestObject.body) {
			bufferedBody = await new Response(requestObject.body).arrayBuffer();
		}
		if (bufferedBody !== null) {
			directRequest = await cloneRequest(requestObject, {
				body: bufferedBody,
			});
		} else {
			// No body to buffer; reuse the original request without overriding `body`.
			directRequest = requestObject;
		}
		corsProxyBody = bufferedBody;
	}

	try {
		return await fetch(directRequest);
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

		/**
		 * When using streaming bodies, buffer into an ArrayBuffer if the
		 * CORS proxy uses `http:`. Streaming request bodies cause Chrome
		 * to silently upgrade HTTP/1.1 to HTTP/2, but an HTTP/1.1-only
		 * server replies with HTTP/1.1, triggering ERR_ALPN_NEGOTIATION_FAILED.
		 *
		 * Inferring the HTTP version from the URL protocol is unreliable and will fail
		 * if the CORS proxy is hosted on a `https://` URL that speaks HTTP < 2. This is
		 * a recognized limitation of the CORS proxy feature. If you host it on an `https://` URL,
		 * make sure to use HTTP/2.
		 *
		 * @see https://developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests
		 */
		let body = corsProxyBody;
		if (useStreaming && body) {
			// In development, corsProxyUrl may be /cors-proxy/. We need to resolve the absolute URL
			// to access the protocol.
			const rootUrl = new URL(import.meta.url);
			rootUrl.pathname = '';
			rootUrl.search = '';
			rootUrl.hash = '';
			const corsProxyUrlObj = new URL(corsProxyUrl, rootUrl.toString());
			if (corsProxyUrlObj.protocol === 'http:') {
				body = await new Response(body).arrayBuffer();
			}
		}

		const newRequest = await cloneRequest(requestObject, {
			url: `${corsProxyUrl}${requestObject.url}`,
			headers,
			body,
			...(requestIntendsToPassCredentials && { credentials: 'include' }),
		});

		// Skip the `init`, it's already folded into `requestObject`.
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
