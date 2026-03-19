import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { PlaygroundBridge } from './bridge-server';

// Use high random port to avoid conflicts
const getPort = () => 19000 + Math.floor(Math.random() * 1000);

describe('PlaygroundBridge token endpoint', () => {
	let bridge: PlaygroundBridge;

	afterEach(async () => {
		await bridge?.close();
	});

	it('returns a session token for allowed origins', async () => {
		const port = getPort();
		bridge = new PlaygroundBridge();
		await bridge.startWebSocketServer(port);

		const response = await fetch(`http://127.0.0.1:${port}/bridge-token`, {
			headers: { Origin: 'http://localhost:5400' },
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.token).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
		);
	});

	it('returns the same token on repeated requests', async () => {
		const port = getPort();
		bridge = new PlaygroundBridge();
		await bridge.startWebSocketServer(port);

		const headers = { Origin: 'http://localhost:5400' };
		const r1 = await fetch(`http://127.0.0.1:${port}/bridge-token`, {
			headers,
		});
		const r2 = await fetch(`http://127.0.0.1:${port}/bridge-token`, {
			headers,
		});

		const t1 = (await r1.json()).token;
		const t2 = (await r2.json()).token;
		expect(t1).toBe(t2);
	});

	it('rejects token requests from disallowed origins', async () => {
		const port = getPort();
		bridge = new PlaygroundBridge();
		await bridge.startWebSocketServer(port);

		const response = await fetch(`http://127.0.0.1:${port}/bridge-token`, {
			headers: { Origin: 'https://evil.com' },
		});

		expect(response.status).toBe(403);
	});

	it('returns CORS headers matching the request origin', async () => {
		const port = getPort();
		bridge = new PlaygroundBridge();
		await bridge.startWebSocketServer(port);

		const response = await fetch(`http://127.0.0.1:${port}/bridge-token`, {
			headers: { Origin: 'http://127.0.0.1:5400' },
		});

		expect(response.headers.get('access-control-allow-origin')).toBe(
			'http://127.0.0.1:5400'
		);
	});

	it('handles CORS preflight OPTIONS request for disallowed origins', async () => {
		const port = getPort();
		bridge = new PlaygroundBridge();
		await bridge.startWebSocketServer(port);

		const response = await fetch(`http://127.0.0.1:${port}/bridge-token`, {
			method: 'OPTIONS',
			headers: {
				Origin: 'https://evil.com',
				'Access-Control-Request-Method': 'GET',
			},
		});

		expect(response.status).toBe(403);
	});

	it('handles CORS preflight OPTIONS request', async () => {
		const port = getPort();
		bridge = new PlaygroundBridge();
		await bridge.startWebSocketServer(port);

		const response = await fetch(`http://127.0.0.1:${port}/bridge-token`, {
			method: 'OPTIONS',
			headers: {
				Origin: 'http://localhost:5400',
				'Access-Control-Request-Method': 'GET',
			},
		});

		expect(response.status).toBe(204);
		expect(response.headers.get('access-control-allow-origin')).toBe(
			'http://localhost:5400'
		);
		expect(response.headers.get('access-control-allow-methods')).toBe(
			'GET'
		);
	});
});

function waitForWebSocket(
	ws: WebSocket,
	state: typeof WebSocket.OPEN | typeof WebSocket.CLOSED
): Promise<void> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
		if (ws.readyState === state) {
			clearTimeout(timeout);
			resolve();
			return;
		}
		ws.on('open', () => {
			if (state === WebSocket.OPEN) {
				clearTimeout(timeout);
				resolve();
			}
		});
		ws.on('close', () => {
			clearTimeout(timeout);
			if (state === WebSocket.CLOSED) {
				resolve();
			} else {
				reject(new Error('WebSocket closed unexpectedly'));
			}
		});
		ws.on('error', () => {
			// close event follows
		});
	});
}

describe('PlaygroundBridge token validation', () => {
	let bridge: PlaygroundBridge;

	afterEach(async () => {
		await bridge?.close();
	});

	it('accepts WebSocket connections with a valid token', async () => {
		const port = getPort();
		bridge = new PlaygroundBridge();
		await bridge.startWebSocketServer(port);

		const res = await fetch(`http://127.0.0.1:${port}/bridge-token`, {
			headers: { Origin: 'http://localhost:5400' },
		});
		const { token } = await res.json();

		const ws = new WebSocket(`ws://127.0.0.1:${port}?token=${token}`);
		await waitForWebSocket(ws, WebSocket.OPEN);
		expect(ws.readyState).toBe(WebSocket.OPEN);
		ws.close();
	});

	it('rejects WebSocket connections without a token', async () => {
		const port = getPort();
		bridge = new PlaygroundBridge();
		await bridge.startWebSocketServer(port);

		const ws = new WebSocket(`ws://127.0.0.1:${port}`);
		await waitForWebSocket(ws, WebSocket.CLOSED);
		expect(ws.readyState).toBe(WebSocket.CLOSED);
	});

	it('rejects WebSocket connections with an invalid token', async () => {
		const port = getPort();
		bridge = new PlaygroundBridge();
		await bridge.startWebSocketServer(port);

		const ws = new WebSocket(`ws://127.0.0.1:${port}?token=wrong-token`);
		await waitForWebSocket(ws, WebSocket.CLOSED);
		expect(ws.readyState).toBe(WebSocket.CLOSED);
	});
});

describe('Origin allowlist', () => {
	let bridge: PlaygroundBridge;

	afterEach(async () => {
		await bridge?.close();
	});

	it('allows playground.wordpress.net', async () => {
		const port = getPort();
		bridge = new PlaygroundBridge();
		await bridge.startWebSocketServer(port);

		const response = await fetch(`http://127.0.0.1:${port}/bridge-token`, {
			headers: {
				Origin: 'https://playground.wordpress.net',
			},
		});
		expect(response.status).toBe(200);
	});

	it('rejects non-localhost origins', async () => {
		const port = getPort();
		bridge = new PlaygroundBridge();
		await bridge.startWebSocketServer(port);

		const response = await fetch(`http://127.0.0.1:${port}/bridge-token`, {
			headers: { Origin: 'https://example.com' },
		});
		expect(response.status).toBe(403);
	});

	it('rejects requests without an Origin header', async () => {
		const port = getPort();
		bridge = new PlaygroundBridge();
		await bridge.startWebSocketServer(port);

		const response = await fetch(`http://127.0.0.1:${port}/bridge-token`);
		expect(response.status).toBe(403);
	});
});
