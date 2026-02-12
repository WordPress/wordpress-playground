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
	const [request1, request2] = await teeRequest(requestObject);

	try {
		return await fetch(request1);
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

		const newRequest = await cloneRequest(request2, {
			url: `${corsProxyUrl}${requestObject.url}`,
			...(requestIntendsToPassCredentials && { credentials: 'include' }),
		});

		const response = await fetch(newRequest, init);

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
