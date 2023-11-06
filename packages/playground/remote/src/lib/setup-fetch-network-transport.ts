import { UniversalPHP } from '@php-wasm/universal';

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
	await playground.onMessage(async (message: string) => {
		const envelope: RequestMessage = JSON.parse(message);
		const { type, data } = envelope;
		if (type !== 'request') {
			return '';
		}

		return handleRequest(data);
	});
}

export async function handleRequest(data: RequestData, fetchFn = fetch) {
	const hostname = new URL(data.url).hostname;
	const fetchUrl = ['api.wordpress.org', 'w.org', 's.w.org'].includes(
		hostname
	)
		? `/plugin-proxy.php?url=${encodeURIComponent(data.url)}`
		: data.url;

	let response;
	try {
		response = await fetchFn(fetchUrl, {
			method: data.method || 'GET',
			headers: data.headers,
			body: data.data,
			credentials: 'omit',
		});
	} catch (e) {
		// console.error(e);
		return new TextEncoder().encode(
			`HTTP/1.1 400 Invalid Request\r\ncontent-type: text/plain\r\n\r\nPlayground could not serve the request.`
		);
	}
	const responseHeaders: string[] = [];
	response.headers.forEach((value, key) => {
		responseHeaders.push(key + ': ' + value);
	});

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
