import { UniversalPHP } from '@php-wasm/universal';
import { defineWpConfigConsts } from '@wp-playground/blueprints';

export interface RequestData {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	data?: string;
}

export interface RequestMessage {
	type: 'request';
	data: RequestData;
}

/**
 * Allow WordPress to make network requests via the fetch API.
 * On the WordPress side, this is handled by Requests_Transport_Fetch
 *
 * @param playground the Playground instance to set up with network support.
 */
export async function setupFetchNetworkTransport(playground: UniversalPHP) {
	await defineWpConfigConsts(playground, {
		consts: {
			USE_FETCH_FOR_REQUESTS: true,
		},
	});

	await playground.onMessage(async (message: string) => {
		let envelope: RequestMessage;
		try {
			// PHP-WASM sends messages as strings, so we can't expect valid JSON.
			envelope = JSON.parse(message);
		} catch (e) {
			return '';
		}
		const { type, data } = envelope;
		if (type !== 'request') {
			return '';
		}

		// PHP encodes empty arrays as JSON arrays, not objects.
		// We can't easily reason about the request body, but we know
		// headers should be an object so let's convert it here.
		if (!data.headers) {
			data.headers = {};
		} else if (Array.isArray(data.headers)) {
			data.headers = Object.fromEntries(data.headers);
		}

		// Let the Playground request handler know that this request is
		// coming from PHP. We can't just add this header to all external
		// requests because of CORS. The browser will refuse to process
		// cross-origin requests with custom headers unless the server
		// explicitly allows them in Access-Control-Allow-Headers.
		const parsedUrl = new URL(data.url);
		if (parsedUrl.hostname === window.location.hostname) {
			data.headers['x-request-issuer'] = 'php';
		}

		return handleRequest(data);
	});
}

export async function handleRequest(data: RequestData, fetchFn = fetch) {
	const hostname = new URL(data.url).hostname;
	const fetchUrl = ['w.org', 's.w.org'].includes(hostname)
		? `/plugin-proxy.php?url=${encodeURIComponent(data.url)}`
		: data.url;

	let response;
	try {
		const fetchMethod = data.method || 'GET';
		const fetchHeaders = data.headers || {};
		if (fetchMethod == 'POST') {
			fetchHeaders['Content-Type'] = 'application/x-www-form-urlencoded';

			/**
			 * Removes a few custom request headers.
			 *
			 * This is required because the fetch API will send a CORS preflight
			 * request if the request is cross-origin and has custom headers.
			 *
			 * However, the api.wordpress.org/core/version-check/1.7/ endpoint
			 * doesn't support CORS preflight requests. These two headers
			 * aren't critical to the request, so we can just remove them.
			 */
			delete fetchHeaders['wp_install'];
			delete fetchHeaders['wp_blog'];
		}

		response = await fetchFn(fetchUrl, {
			method: fetchMethod,
			headers: fetchHeaders,
			body: data.data,
			credentials: 'omit',
		});
	} catch (e) {
		return new TextEncoder().encode(
			`HTTP/1.1 400 Invalid Request\r\ncontent-type: text/plain\r\n\r\nPlayground could not serve the request.`
		);
	}
	const responseHeaders: string[] = [];
	response.headers.forEach((value, key) => {
		responseHeaders.push(key + ': ' + value);
	});

	/*
	 * Technically we should only send ASCII here and ensure we don't send control
	 * characters or newlines. We ought to be very careful with HTTP headers since
	 * some attacks rely on assumed processing of them to let things slip in that
	 * would end the headers section before its done. e.g. we don't want to allow
	 * emoji in a header and we don't want to allow \r\n\r\n in a header.
	 *
	 * That being said, the browser takes care of it for us.
	 * response.headers is an instance of the Headers class, and you just can't
	 * construct the Headers instance if the values are malformed:
	 *
	 * > new Headers({'Content-type': 'text/html\r\n\r\nBreakout!'})
	 * Failed to construct 'Headers': Invalid value
	 */
	const headersText =
		[
			'HTTP/1.1 ' + response.status + ' ' + response.statusText,
			...responseHeaders,
		].join('\r\n') + `\r\n\r\n`;
	const headersBuffer = new TextEncoder().encode(headersText);
	const bodyBuffer = new Uint8Array(await response.arrayBuffer());
	const jointBuffer = new Uint8Array(
		headersBuffer.byteLength + bodyBuffer.byteLength
	);
	jointBuffer.set(headersBuffer);
	jointBuffer.set(bodyBuffer, headersBuffer.byteLength);

	return jointBuffer;
}
