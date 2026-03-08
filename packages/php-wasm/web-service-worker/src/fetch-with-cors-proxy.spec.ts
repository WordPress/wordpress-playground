import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithCorsProxy } from './fetch-with-cors-proxy';
import { FirewallInterferenceError } from './firewall-interference-error';

/**
 * Intercepts the Request constructor to record whether each
 * Request was built with a ReadableStream body ('stream') or a
 * buffered body like ArrayBuffer/string ('buffer').
 *
 * This lets tests assert the body *type* that reached the final
 * fetch() call — the actual property that matters for the
 * HTTP/1.1 duplex problem.
 */
function trackRequestBodies() {
	const bodyTypeByRequest = new WeakMap<Request, string>();
	const OriginalRequest = globalThis.Request;
	globalThis.Request = new Proxy(OriginalRequest, {
		construct(target, args, newTarget) {
			const instance = Reflect.construct(target, args, newTarget);
			const [, init] = args;
			if (init?.body !== undefined && init.body !== null) {
				bodyTypeByRequest.set(
					instance,
					init.body instanceof ReadableStream ? 'stream' : 'buffer'
				);
			}
			return instance;
		},
	}) as typeof Request;
	return {
		bodyTypeOf(request: Request): string | undefined {
			return bodyTypeByRequest.get(request);
		},
		restore() {
			globalThis.Request = OriginalRequest;
		},
	};
}

describe('fetchWithCorsProxy', () => {
	let requestTracker: ReturnType<typeof trackRequestBodies> | null = null;

	afterEach(() => {
		vi.restoreAllMocks();
		if (requestTracker) {
			requestTracker.restore();
			requestTracker = null;
		}
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
		requestTracker = trackRequestBodies();
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
		// The body passed to the Request constructor must have been a
		// buffer (ArrayBuffer), not a ReadableStream. That is the
		// whole point of duplexSafeFetch — avoid duplex: 'half'.
		expect(requestTracker.bodyTypeOf(sentRequest)).toBe('buffer');
		expect(await new Response(sentRequest.body).text()).toBe(
			'streamed data'
		);
	});

	it('does not buffer the request body for https:// URLs', async () => {
		requestTracker = trackRequestBodies();
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
		// The exact same Request object should reach fetch() –
		// no cloning, no buffering, just a pass-through.
		expect(sentRequest).toBe(request);
		// Confirm the body type is still a stream, not a buffer.
		expect(requestTracker.bodyTypeOf(sentRequest)).toBe('stream');
	});

	it('buffers the request body when retrying via an http:// CORS proxy', async () => {
		requestTracker = trackRequestBodies();
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
		// The first call (direct https://) keeps the stream body.
		const directRequest = fetchMock.mock.calls[0][0] as Request;
		expect(requestTracker.bodyTypeOf(directRequest)).toBe('stream');
		// The second call (http:// CORS proxy) must buffer the body.
		const proxyRequest = fetchMock.mock.calls[1][0] as Request;
		expect(requestTracker.bodyTypeOf(proxyRequest)).toBe('buffer');
		expect(proxyRequest.url).toBe(
			'http://localhost:5400/cors-proxy/?url=https://example.com/api'
		);
		expect(await new Response(proxyRequest.body).text()).toBe(
			'upload payload'
		);
		expect(await response.text()).toBe('proxied');
	});

	it('forwards init to duplexSafeFetch in the CORS proxy retry path', async () => {
		requestTracker = trackRequestBodies();
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
		// The http:// CORS proxy URL triggers buffering.
		const proxyRequest = fetchMock.mock.calls[1][0] as Request;
		expect(requestTracker.bodyTypeOf(proxyRequest)).toBe('buffer');
		expect(proxyRequest.url).toBe(
			'http://localhost:5400/cors-proxy/?url=https://example.com/api'
		);
		// The body from init should survive the tee → clone → buffer
		// pipeline.
		expect(await new Response(proxyRequest.body).text()).toBe('form data');
		expect(await response.text()).toBe('proxied');
	});
});
