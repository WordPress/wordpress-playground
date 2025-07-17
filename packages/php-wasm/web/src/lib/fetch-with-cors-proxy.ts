import { cloneRequest, teeRequest } from '@php-wasm/web-service-worker';

export async function fetchWithCorsProxy(
	input: RequestInfo,
	init?: RequestInit,
	corsProxyUrl?: string,
	playgroundUrl?: string
): Promise<Response> {
	const requestObject =
		typeof input === 'string' ? new Request(input, init) : input;
	if (!corsProxyUrl) {
		return await fetch(requestObject);
	}

	/**
	 * Never try to proxy requests to the playground itself. The remote proxy
	 * won't be able to reach it. At best, it will produce a cryptic error
	 * message. At worst, it will time out, making the user wait for 30 seconds.
	 */
	const playgroundUrlObj = playgroundUrl ? new URL(playgroundUrl) : null;
	const requestUrlObj = new URL(
		requestObject.url,
		playgroundUrlObj || undefined
	);

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

		return await fetch(newRequest, init);
	}
}
