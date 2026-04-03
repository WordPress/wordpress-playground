import { cloneRequest, prepareRequestForRetry } from './utils';
import { FirewallInterferenceError } from './firewall-interference-error';

const CORS_PROXY_HEADER = 'X-Playground-Cors-Proxy';

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

	const {
		directRequest,
		retryBody: corsProxyBody,
		useStreamingBody,
	} = await prepareRequestForRetry(requestObject);

	try {
		return await fetch(directRequest);
	} catch {
		// If the developer has explicitly allowed the request to pass the
		// credentials headers with the X-Cors-Proxy-Allowed-Request-Headers header,
		// then let's include those credentials in the fetch() request.
		const headers = new Headers(directRequest.headers);
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
		if (
			useStreamingBody &&
			body &&
			new URL(corsProxyUrl, import.meta.url).protocol === 'http:'
		) {
			body = await new Response(body).arrayBuffer();
		}

		const newRequest = await cloneRequest(directRequest, {
			url: `${corsProxyUrl}${directRequest.url}`,
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
				directRequest.url,
				response.status,
				response.statusText
			);
		}

		return response;
	}
}
