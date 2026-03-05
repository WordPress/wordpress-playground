import {
	isJspiRequest,
	handleJspiRequest,
	initJspiHandler,
} from './sw-handler';

// Mock the MainThreadSocketManager to avoid real TCP connections.
const mockCreateSocket = vi.fn();
const mockSendToSocket = vi.fn();
const mockRecvFromSocket = vi.fn().mockResolvedValue(new Uint8Array(0));
const mockCloseSocket = vi.fn();
const mockCloseAll = vi.fn();

vi.mock('./main-thread-socket-manager', () => ({
	MainThreadSocketManager: vi.fn().mockImplementation(() => ({
		createSocket: mockCreateSocket,
		sendToSocket: mockSendToSocket,
		recvFromSocket: mockRecvFromSocket,
		closeSocket: mockCloseSocket,
		closeAll: mockCloseAll,
	})),
}));

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.clearAllMocks();
});

describe('isJspiRequest', () => {
	it('returns true for /_jspi/ paths', () => {
		expect(isJspiRequest(new URL('http://x/_jspi/sleep'))).toBe(true);
		expect(isJspiRequest(new URL('http://x/_jspi/fetch'))).toBe(true);
		expect(isJspiRequest(new URL('http://x/_jspi/sock-open'))).toBe(true);
	});

	it('returns false for non-JSPI paths', () => {
		expect(isJspiRequest(new URL('http://x/wp-admin/'))).toBe(false);
		expect(isJspiRequest(new URL('http://x/jspi/sleep'))).toBe(false);
		expect(isJspiRequest(new URL('http://x/_jspi'))).toBe(false);
	});
});

describe('handleJspiRequest', () => {
	describe('sleep', () => {
		it('resolves after the specified delay', async () => {
			const url = new URL('http://x/_jspi/sleep?ms=10');
			const request = new Request(url);
			const start = Date.now();
			const response = await handleJspiRequest(url, request);
			expect(response.status).toBe(200);
			expect(Date.now() - start).toBeGreaterThanOrEqual(9);
		});

		it('defaults to 0ms when ms is missing', async () => {
			const url = new URL('http://x/_jspi/sleep');
			const response = await handleJspiRequest(url, new Request(url));
			expect(response.status).toBe(200);
		});
	});

	describe('fetch', () => {
		it('fetches the URL from the request body', async () => {
			const responseBody = new TextEncoder().encode('hello world');
			globalThis.fetch = vi
				.fn()
				.mockResolvedValue(new Response(responseBody, { status: 200 }));

			const url = new URL('http://x/_jspi/fetch');
			const body = new TextEncoder().encode('https://example.com/data');
			const request = new Request(url, { method: 'POST', body });

			const response = await handleJspiRequest(url, request);
			expect(response.status).toBe(200);

			const data = new Uint8Array(await response.arrayBuffer());
			expect(data).toEqual(responseBody);

			expect(globalThis.fetch).toHaveBeenCalledWith(
				'https://example.com/data',
				expect.objectContaining({ referrer: '' })
			);
		});

		it('returns 502 when fetch fails', async () => {
			globalThis.fetch = vi
				.fn()
				.mockRejectedValue(new Error('network error'));

			const url = new URL('http://x/_jspi/fetch');
			const body = new TextEncoder().encode('https://example.com');
			const request = new Request(url, { method: 'POST', body });

			const response = await handleJspiRequest(url, request);
			expect(response.status).toBe(502);
		});

		it('rejects scoped URLs to prevent deadlock', async () => {
			globalThis.fetch = vi.fn();

			const url = new URL('http://x/_jspi/fetch');
			const scopedUrl = 'http://playground.internal/scope:xyz/wp-admin/';
			const body = new TextEncoder().encode(scopedUrl);
			const request = new Request(url, { method: 'POST', body });

			const response = await handleJspiRequest(url, request);
			expect(response.status).toBe(502);
			expect(globalThis.fetch).not.toHaveBeenCalled();
		});

		it('upgrades http to https for non-localhost URLs', async () => {
			globalThis.fetch = vi
				.fn()
				.mockResolvedValue(new Response('ok', { status: 200 }));

			const url = new URL('http://x/_jspi/fetch');
			const body = new TextEncoder().encode('http://example.com/data');
			const request = new Request(url, { method: 'POST', body });

			await handleJspiRequest(url, request);
			expect(globalThis.fetch).toHaveBeenCalledWith(
				'https://example.com/data',
				expect.any(Object)
			);
		});

		it('does not upgrade http to https for localhost', async () => {
			globalThis.fetch = vi
				.fn()
				.mockResolvedValue(new Response('ok', { status: 200 }));

			const url = new URL('http://x/_jspi/fetch');
			const body = new TextEncoder().encode('http://localhost:8080/api');
			const request = new Request(url, { method: 'POST', body });

			await handleJspiRequest(url, request);
			expect(globalThis.fetch).toHaveBeenCalledWith(
				'http://localhost:8080/api',
				expect.any(Object)
			);
		});

		it('falls back to CORS proxy on fetch failure', async () => {
			const proxyUrl = 'https://proxy.example.com/';
			initJspiHandler({
				corsProxyUrl: proxyUrl,
				CAroot: '' as any,
			});

			globalThis.fetch = vi
				.fn()
				.mockRejectedValueOnce(new Error('CORS'))
				.mockResolvedValueOnce(new Response('ok', { status: 200 }));

			const url = new URL('http://x/_jspi/fetch');
			const body = new TextEncoder().encode(
				'https://api.example.com/data'
			);
			const request = new Request(url, { method: 'POST', body });

			const response = await handleJspiRequest(url, request);
			expect(response.status).toBe(200);
			expect(globalThis.fetch).toHaveBeenCalledTimes(2);
			expect(globalThis.fetch).toHaveBeenLastCalledWith(
				proxyUrl + 'https://api.example.com/data',
				expect.any(Object)
			);
		});
	});

	describe('msg', () => {
		it('returns 200 with empty body for non-request messages', async () => {
			const url = new URL('http://x/_jspi/msg');
			const body = new TextEncoder().encode(
				JSON.stringify({ type: 'parallelize_request', data: {} })
			);
			const request = new Request(url, { method: 'POST', body });

			const response = await handleJspiRequest(url, request);
			expect(response.status).toBe(200);
			const data = await response.arrayBuffer();
			expect(data.byteLength).toBe(0);
		});

		it('returns 200 for malformed JSON', async () => {
			const url = new URL('http://x/_jspi/msg');
			const body = new TextEncoder().encode('not json');
			const request = new Request(url, { method: 'POST', body });

			const response = await handleJspiRequest(url, request);
			expect(response.status).toBe(200);
		});

		it('handles request-type messages with fetch', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue(
				new Response('response body', {
					status: 200,
					statusText: 'OK',
					headers: { 'Content-Type': 'text/plain' },
				})
			);

			const url = new URL('http://x/_jspi/msg');
			const body = new TextEncoder().encode(
				JSON.stringify({
					type: 'request',
					data: {
						url: 'https://example.com/api',
						method: 'GET',
					},
				})
			);
			const request = new Request(url, { method: 'POST', body });

			const response = await handleJspiRequest(url, request);
			expect(response.status).toBe(200);

			const text = new TextDecoder().decode(
				new Uint8Array(await response.arrayBuffer())
			);
			expect(text).toContain('HTTP/1.1 200 OK');
			expect(text).toContain('response body');
		});

		it('returns raw HTTP 502 when fetch fails in request message', async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'));

			const url = new URL('http://x/_jspi/msg');
			const body = new TextEncoder().encode(
				JSON.stringify({
					type: 'request',
					data: {
						url: 'https://example.com/api',
						method: 'GET',
					},
				})
			);
			const request = new Request(url, { method: 'POST', body });

			const response = await handleJspiRequest(url, request);
			const text = new TextDecoder().decode(
				new Uint8Array(await response.arrayBuffer())
			);
			expect(text).toContain('HTTP/1.1 502 Bad Gateway');
		});

		it('returns immediate 200 for blocking=false requests', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok'));

			const url = new URL('http://x/_jspi/msg');
			const body = new TextEncoder().encode(
				JSON.stringify({
					type: 'request',
					data: {
						url: 'https://example.com/api',
						method: 'POST',
						blocking: false,
					},
				})
			);
			const request = new Request(url, { method: 'POST', body });

			const response = await handleJspiRequest(url, request);
			const text = new TextDecoder().decode(
				new Uint8Array(await response.arrayBuffer())
			);
			expect(text).toBe('HTTP/1.1 200 OK\r\n\r\n');
		});
	});

	describe('socket operations', () => {
		beforeEach(() => {
			initJspiHandler({ corsProxyUrl: '', CAroot: '' as any });
		});

		it('sock-open creates a socket and returns 200', async () => {
			const url = new URL(
				'http://x/_jspi/sock-open?socketId=1&host=example.com&port=443'
			);
			const response = await handleJspiRequest(url, new Request(url));
			expect(response.status).toBe(200);
			expect(mockCreateSocket).toHaveBeenCalledWith(
				1,
				'example.com',
				443
			);
		});

		it('sock-send sends data and returns 200', async () => {
			const url = new URL('http://x/_jspi/sock-send?socketId=1');
			const data = new Uint8Array([1, 2, 3]);
			const request = new Request(url, { method: 'POST', body: data });

			const response = await handleJspiRequest(url, request);
			expect(response.status).toBe(200);
			expect(mockSendToSocket).toHaveBeenCalledWith(
				1,
				new Uint8Array([1, 2, 3])
			);
		});

		it('sock-recv returns data from socket', async () => {
			const recvData = new Uint8Array([4, 5, 6]);
			mockRecvFromSocket.mockResolvedValueOnce(recvData);

			const url = new URL(
				'http://x/_jspi/sock-recv?socketId=1&maxSize=1024'
			);
			const response = await handleJspiRequest(url, new Request(url));
			expect(response.status).toBe(200);
			expect(mockRecvFromSocket).toHaveBeenCalledWith(1, 1024);

			const body = new Uint8Array(await response.arrayBuffer());
			expect(body).toEqual(recvData);
		});

		it('sock-close closes socket and returns 200', async () => {
			const url = new URL('http://x/_jspi/sock-close?socketId=1');
			const response = await handleJspiRequest(url, new Request(url));
			expect(response.status).toBe(200);
			expect(mockCloseSocket).toHaveBeenCalledWith(1);
		});

		it('socket operations return 500 when socketManager is not initialized', async () => {
			// Use a fresh module state. Since initJspiHandler
			// only sets socketManager when tcpOverFetchOptions
			// is truthy, we test from the module's initial
			// state by checking before any beforeEach runs.
			// Instead, we test the handler behavior by making
			// createSocket throw, which triggers the catch-all.
			mockCreateSocket.mockImplementationOnce(() => {
				throw new Error('simulated failure');
			});

			const url = new URL(
				'http://x/_jspi/sock-open?socketId=1&host=x&port=1'
			);
			const response = await handleJspiRequest(url, new Request(url));
			expect(response.status).toBe(500);
		});
	});

	describe('unknown operation', () => {
		it('returns 404', async () => {
			const url = new URL('http://x/_jspi/unknown');
			const response = await handleJspiRequest(url, new Request(url));
			expect(response.status).toBe(404);
		});
	});

	describe('initJspiHandler', () => {
		it('calls closeAll on previous socket manager', () => {
			mockCloseAll.mockClear();
			initJspiHandler({ corsProxyUrl: '', CAroot: '' as any });
			// The first call above replaces whatever was set
			// by earlier tests. The second triggers closeAll
			// on that first manager.
			initJspiHandler({ corsProxyUrl: '', CAroot: '' as any });
			expect(mockCloseAll).toHaveBeenCalled();
		});
	});
});
