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

	it('passes request through to fetch for localhost http:// URLs', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('ok'));

		const body = new ReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode('streamed data'));
				controller.close();
			},
		});
		const request = new Request('http://localhost:8080/api', {
			method: 'POST',
			body,
			// @ts-expect-error duplex is required for streaming bodies
			duplex: 'half',
		});

		await fetchWithCorsProxy(request);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const sentRequest = fetchMock.mock.calls[0][0] as Request;
		// Direct fetch — no buffering, same Request passed through.
		expect(sentRequest).toBe(request);
		expect(request.bodyUsed).toBe(false);
	});

	it('passes request through to fetch for https:// URLs without proxy', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('ok'));

		const body = new ReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode('streamed data'));
				controller.close();
			},
		});
		const request = new Request('https://example.com/api', {
			method: 'POST',
			body,
			// @ts-expect-error duplex is required for streaming bodies
			duplex: 'half',
		});

		// No corsProxyUrl → direct fetch, no tee/clone involved.
		await fetchWithCorsProxy(request);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const sentRequest = fetchMock.mock.calls[0][0] as Request;
		// Direct fetch — no buffering, same Request passed through.
		expect(sentRequest).toBe(request);
		expect(request.bodyUsed).toBe(false);
	});

	it('buffers the request body when retrying via an http:// CORS proxy', async () => {
		const corsProxyHeaders = new Headers();
		corsProxyHeaders.set('X-Playground-Cors-Proxy', 'true');

		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockRejectedValueOnce(new Error('CORS'))
			.mockResolvedValueOnce(
				new Response('proxied', { headers: corsProxyHeaders })
			);

		const body = new ReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode('upload payload'));
				controller.close();
			},
		});
		const request = new Request('https://example.com/api', {
			method: 'POST',
			body,
			// @ts-expect-error duplex is required for streaming bodies
			duplex: 'half',
		});

		const response = await fetchWithCorsProxy(
			request,
			undefined,
			'http://localhost:5400/cors-proxy/?url='
		);

		expect(fetchMock).toHaveBeenCalledTimes(2);
		const proxyRequest = fetchMock.mock.calls[1][0] as Request;
		expect(proxyRequest.url).toBe(
			'http://localhost:5400/cors-proxy/?url=https://example.com/api'
		);
		// The buffered content should survive the tee → clone → buffer
		// pipeline intact.
		expect(await new Response(proxyRequest.body).text()).toBe(
			'upload payload'
		);
		expect(await response.text()).toBe('proxied');
	});

	it('wraps multipart/form-data Content-Type when retrying via CORS proxy', async () => {
		const corsProxyHeaders = new Headers();
		corsProxyHeaders.set('X-Playground-Cors-Proxy', 'true');

		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockRejectedValueOnce(new Error('CORS'))
			.mockResolvedValueOnce(
				new Response('proxied', { headers: corsProxyHeaders })
			);

		const boundary = '----WebKitFormBoundary7MA4YWxk';
		const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="data.json"\r\nContent-Type: application/json\r\n\r\n["/path/to/file"]\r\n--${boundary}--\r\n`;
		const request = new Request('https://example.com/api', {
			method: 'POST',
			headers: {
				'Content-Type': `multipart/form-data; boundary=${boundary}`,
			},
			body,
		});

		await fetchWithCorsProxy(
			request,
			undefined,
			'https://proxy.test/?url='
		);

		expect(fetchMock).toHaveBeenCalledTimes(2);
		const proxyRequest = fetchMock.mock.calls[1][0] as Request;
		// Content-Type should be wrapped to prevent PHP auto-parsing
		expect(proxyRequest.headers.get('content-type')).toBe(
			'application/octet-stream'
		);
		expect(proxyRequest.headers.get('x-cors-proxy-content-type')).toBe(
			`multipart/form-data; boundary=${boundary}`
		);
		// The body should survive intact
		expect(await new Response(proxyRequest.body).text()).toBe(body);
	});

	it('forwards init to duplexSafeFetch in the CORS proxy retry path', async () => {
		const corsProxyHeaders = new Headers();
		corsProxyHeaders.set('X-Playground-Cors-Proxy', 'true');

		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockRejectedValueOnce(new Error('CORS'))
			.mockResolvedValueOnce(
				new Response('proxied', { headers: corsProxyHeaders })
			);

		// When input is a string, init builds the initial Request and
		// is also forwarded to duplexSafeFetch in the retry path.
		const response = await fetchWithCorsProxy(
			'https://example.com/api',
			{ method: 'POST', body: 'form data' },
			'http://localhost:5400/cors-proxy/?url='
		);

		expect(fetchMock).toHaveBeenCalledTimes(2);
		const proxyRequest = fetchMock.mock.calls[1][0] as Request;
		expect(proxyRequest.url).toBe(
			'http://localhost:5400/cors-proxy/?url=https://example.com/api'
		);
		// The body from init should survive the tee → clone → buffer
		// pipeline.
		expect(await new Response(proxyRequest.body).text()).toBe('form data');
		expect(await response.text()).toBe('proxied');
	});
});
