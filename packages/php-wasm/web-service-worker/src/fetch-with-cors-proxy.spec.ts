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

	it('buffers a streaming request body for http:// URLs', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('ok'));
		// Spy on the exact method duplexSafeFetch uses to buffer:
		// new Response(body).arrayBuffer(). If it was called, the body
		// was read into an ArrayBuffer and re-attached to a new Request.
		const arrayBufferSpy = vi.spyOn(Response.prototype, 'arrayBuffer');

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

		// The body was buffered via Response.arrayBuffer().
		expect(arrayBufferSpy).toHaveBeenCalledTimes(1);
		// The request was re-created from the buffered body.
		expect(sentRequest).not.toBe(request);
		// The buffered content should be faithfully re-attached.
		expect(await new Response(sentRequest.body).text()).toBe(
			'streamed data'
		);
	});

	it('does not buffer the request body for https:// URLs', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('ok'));
		const arrayBufferSpy = vi.spyOn(Response.prototype, 'arrayBuffer');

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
		// No buffering should have occurred for https://.
		expect(arrayBufferSpy).not.toHaveBeenCalled();
		// The exact same Request object should reach fetch() –
		// no cloning, no buffering, just a pass-through.
		expect(sentRequest).toBe(request);
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
		const arrayBufferSpy = vi.spyOn(Response.prototype, 'arrayBuffer');

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
		// The first call (direct https://) should NOT trigger buffering.
		// The second call (http:// CORS proxy) should.
		expect(arrayBufferSpy).toHaveBeenCalledTimes(1);

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

	it('forwards init to duplexSafeFetch in the CORS proxy retry path', async () => {
		const corsProxyHeaders = new Headers();
		corsProxyHeaders.set('X-Playground-Cors-Proxy', 'true');

		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockRejectedValueOnce(new Error('CORS'))
			.mockResolvedValueOnce(
				new Response('proxied', { headers: corsProxyHeaders })
			);
		const arrayBufferSpy = vi.spyOn(Response.prototype, 'arrayBuffer');

		// When input is a string, init builds the initial Request and
		// is also forwarded to duplexSafeFetch in the retry path.
		const response = await fetchWithCorsProxy(
			'https://example.com/api',
			{ method: 'POST', body: 'form data' },
			'http://localhost:5400/cors-proxy/?url='
		);

		expect(fetchMock).toHaveBeenCalledTimes(2);
		// The http:// CORS proxy URL triggers buffering.
		expect(arrayBufferSpy).toHaveBeenCalledTimes(1);

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
