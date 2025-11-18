import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithCorsProxy } from './fetch-with-cors-proxy';

describe('fetchWithCorsProxy', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('upgrades plain HTTP requests to HTTPS before fetching directly', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('ok'));

		await fetchWithCorsProxy('http://example.com/resource.zip');

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const directRequest = fetchMock.mock.calls[0][0] as Request;
		expect(directRequest.url).toBe('https://example.com/resource.zip');
	});

	it('upgrades HTTP URLs before retrying via the CORS proxy', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockRejectedValueOnce(new Error('network fail'))
			.mockResolvedValueOnce(new Response('proxied'));

		await fetchWithCorsProxy(
			'http://example.com/wp-cron.php',
			undefined,
			'https://proxy.test/?url='
		);

		expect(fetchMock).toHaveBeenCalledTimes(2);
		const initialRequest = fetchMock.mock.calls[0][0] as Request;
		expect(initialRequest.url).toBe('https://example.com/wp-cron.php');

		const proxiedRequest = fetchMock.mock.calls[1][0] as Request;
		expect(proxiedRequest.url).toBe(
			'https://proxy.test/?url=https://example.com/wp-cron.php'
		);
	});
});
