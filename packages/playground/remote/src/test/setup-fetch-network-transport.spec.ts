import { handleRequest } from '../lib/setup-fetch-network-transport';

describe('handleRequest', () => {
	it('Should return a correct response to a basic request', async () => {
		const fetchMock = vitest.fn(async () => {
			return {
				status: 200,
				statusText: 'OK',
				headers: new Headers({
					'Content-type': 'text/html',
				}),
				arrayBuffer: async () => {
					return new TextEncoder().encode('Hello, world!');
				},
			};
		});
		const response = await handleRequest(
			{
				url: 'https://playground.wordpress.net/',
				headers: { 'Content-type': 'text/html' },
			},
			{ fetchFn: fetchMock as any }
		);
		expect(new TextDecoder().decode(response)).toBe(
			`HTTP/1.1 200 OK\r\ncontent-type: text/html\r\n\r\nHello, world!`
		);
	});
	it('Should reject responses with malicious headers trying to terminate the headers section early', async () => {
		const fetchMock = vitest.fn(async () => {
			return {
				status: 200,
				statusText: 'OK',
				headers: new Headers({
					'Content-type': 'text/html✅',
				}),
				arrayBuffer: async () => {
					return new TextEncoder().encode('Hello, world!');
				},
			};
		});
		const response = await handleRequest(
			{
				url: 'https://playground.wordpress.net/',
				headers: { 'Content-type': 'text/html' },
			},
			{ fetchFn: fetchMock as any }
		);
		expect(new TextDecoder().decode(response)).toBe(
			`HTTP/1.1 400 Invalid Request\r\ncontent-type: text/plain\r\n\r\nPlayground could not serve the request.`
		);
	});
});
