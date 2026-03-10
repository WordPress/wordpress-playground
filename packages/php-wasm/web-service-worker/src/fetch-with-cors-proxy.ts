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
		return await duplexSafeFetch(requestObject);
	}

	if (requestUrlObj.protocol === 'http:') {
		requestUrlObj.protocol = 'https:';
		const httpsUrl = requestUrlObj.toString();
		requestObject = await cloneRequest(requestObject, { url: httpsUrl });
		requestUrlObj = new URL(httpsUrl);
	}
	if (!corsProxyUrl) {
		return await duplexSafeFetch(requestObject);
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
		return await duplexSafeFetch(requestObject);
	}

	// Tee the request to avoid consuming the request body stream on the initial
	// fetch() so that we can retry through the cors proxy.
	const [request1, request2] = await teeRequest(requestObject);

	try {
		return await duplexSafeFetch(request1);
	} catch {
		// If the developer has explicitly allowed the request to pass the
		// credentials headers with the X-Cors-Proxy-Allowed-Request-Headers header,
		// then let's include those credentials in the fetch() request.
		const headers = new Headers(request2.headers);
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

		const newRequest = await cloneRequest(request2, {
			url: `${corsProxyUrl}${requestObject.url}`,
			headers,
			...(requestIntendsToPassCredentials && { credentials: 'include' }),
		});

		// Don't pass `init` here – it was already folded into
		// `requestObject` at the top of this function. Passing it again
		// would let it override the proxy URL, wrapped headers, and
		// buffered body we just prepared.
		const response = await duplexSafeFetch(newRequest);

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

/**
 * A version of fetch() that buffers streaming request bodies into an
 * ArrayBuffer before calling fetch().
 *
 * This is necessary for two reasons:
 *
 * 1. Chrome does not support using a ReadableStream request body
 *    with HTTP/1.1 requests. If we just always set `duplex: 'half'`,
 *    we'll get an ERR_ALPN_NEGOTIATION_FAILED error as Chrome will
 *    refuse to use duplex over HTTP/1.1 and will switch to HTTP/2.
 *    A HTTP/1.1-only server, however, will still reply with a HTTP/1.1
 *    response, causing that ALPN error.
 *
 * 2. Production CORS proxies (behind CDNs, load balancers, or PHP's
 *    multipart parsing) may not correctly forward a half-duplex
 *    streaming body. Buffering ensures the full body is sent as a
 *    single chunk.
 */
async function duplexSafeFetch(
	request: Request,
	init?: RequestInit
): Promise<Response> {
	// Combine the base request and init into a single effective Request so that
	// any overrides in init (including body) are taken into account before
	// buffering.
	let effectiveRequest = init ? new Request(request, init) : request;

	if (effectiveRequest.body) {
		const body = await new Response(effectiveRequest.body).arrayBuffer();
		effectiveRequest = await cloneRequest(effectiveRequest, {
			body,
		});
	}

	return fetch(effectiveRequest);
}
