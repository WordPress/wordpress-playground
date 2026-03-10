import { cloneRequest, teeRequest } from './utils';
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

	// Tee the request to avoid consuming the request body stream on the initial
	// fetch() so that we can retry through the cors proxy.
	const [directRequest, corsProxyRequest] = await teeRequest(requestObject);

	try {
		return await fetch(directRequest);
	} catch {
		// If the developer has explicitly allowed the request to pass the
		// credentials headers with the X-Cors-Proxy-Allowed-Request-Headers header,
		// then let's include those credentials in the fetch() request.
		const headers = new Headers(corsProxyRequest.headers);
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
		 * Buffer the cors proxy request body into an ArrayBuffer before calling fetch().
		 *
		 * This is necessary, because Chrome only supports using a ReadableStream request body
		 * when fetch() is called with the `duplex: 'half'` option. However, duplex connections
		 * are problematic:
		 *
		 * 1. They don't work with the local dev server, which runs at a http:// URL.
		 *    When the duplex option is set, Chrome silently upgrades a HTTP/1.1 request
		 *    to HTTP/2. However, our HTTP/1.1-only local dev server still replies
		 *    with a HTTP/1.1 response. Chrome then treats the request as failed with an
		 *    ERR_ALPN_NEGOTIATION_FAILED error.
		 *
		 * 2. They don't work with the official Playground CORS proxy at https://wordpress-playground-cors-proxy.net/.
		 *    The server infrastructure just can't handle duplex POST requests. Something between
		 *    the browser and the cors-proxy.php runtime buffers the entire body anyway. When
		 *    it can't, it treats the request body as empty and fails with a 400 Bad Request error
		 *    as 0 bytes were sent instead of the expected Content-Length. This can be true
		 *    for any PHP-hosted script out there. An edge proxy, a load balancer, a reverse proxy
		 *    may not support duplex POST requests either.
		 *
		 * We're already in the final `} catch {` block. We've already failed to send a direct
		 * fetch with a streamed body. Maybe it was due to the duplex problem, maybe not, but
		 * this is our last chance so let's maximize the probability of success. The entire request
		 * body must have been produced by now anyway, since the prior fetch() had to send it,
		 * so it's likely buffered somewhere in the browser's memory. We're just changing the
		 * data type from ReadableStream to ArrayBuffer to make that explicit.
		 */
		const body = corsProxyRequest.body
			? await new Response(corsProxyRequest.body).arrayBuffer()
			: undefined;

		const newRequest = await cloneRequest(corsProxyRequest, {
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
