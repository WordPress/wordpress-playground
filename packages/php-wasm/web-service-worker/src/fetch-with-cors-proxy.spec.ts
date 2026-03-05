import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithCorsProxy } from './fetch-with-cors-proxy';
import { FirewallInterferenceError } from './firewall-interference-error';

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
		const corsProxyHeaders = new Headers();
		corsProxyHeaders.set('X-Playground-Cors-Proxy', 'true');

		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockRejectedValueOnce(new Error('network fail'))
			.mockResolvedValueOnce(
				new Response('proxied', { headers: corsProxyHeaders })
			);

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

	it('throws FirewallInterferenceError when CORS proxy response lacks identification header', async () => {
		vi.spyOn(globalThis, 'fetch')
			.mockRejectedValueOnce(new Error('network fail'))
			.mockResolvedValueOnce(
				new Response('blocked', {
					status: 403,
					statusText: 'Forbidden',
					// Note: no X-Playground-Cors-Proxy header
				})
			);

		await expect(
			fetchWithCorsProxy(
				'https://example.com/resource.zip',
				undefined,
				'https://proxy.test/?url='
			)
		).rejects.toThrow(FirewallInterferenceError);
	});

	it('returns response normally when CORS proxy header is present', async () => {
		const headers = new Headers();
		headers.set('X-Playground-Cors-Proxy', 'true');

		vi.spyOn(globalThis, 'fetch')
			.mockRejectedValueOnce(new Error('network fail'))
			.mockResolvedValueOnce(
				new Response('proxied', {
					status: 200,
					headers,
				})
			);

		const response = await fetchWithCorsProxy(
			'https://example.com/resource.zip',
			undefined,
			'https://proxy.test/?url='
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('proxied');
	});

	it('never proxies localhost requests even if direct fetch fails', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockRejectedValue(new Error('connection refused'));

		await expect(
			fetchWithCorsProxy(
				'http://localhost:8080/api',
				undefined,
				'https://proxy.test/?url='
			)
		).rejects.toThrow('connection refused');

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const request = fetchMock.mock.calls[0][0] as Request;
		expect(request.url).toBe('http://localhost:8080/api');
	});

	it('never proxies 127.0.0.1 requests', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('ok'));

		await fetchWithCorsProxy(
			'http://127.0.0.1:3000/endpoint',
			undefined,
			'https://proxy.test/?url='
		);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const request = fetchMock.mock.calls[0][0] as Request;
		expect(request.url).toBe('http://127.0.0.1:3000/endpoint');
	});

	it('does not upgrade localhost HTTP to HTTPS when corsProxyUrl is configured', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('ok'));

		await fetchWithCorsProxy(
			'http://localhost:1234/v1/chat/completions',
			undefined,
			'https://proxy.test/?url='
		);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const request = fetchMock.mock.calls[0][0] as Request;
		// Should stay as http, not upgraded to https
		expect(request.url).toBe('http://localhost:1234/v1/chat/completions');
	});
});
