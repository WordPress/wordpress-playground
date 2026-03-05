import { PolyfillProxyWebSocket } from './polyfill-proxy-websocket';

const mockSendSyncXhr = vi.fn();

vi.mock('./sync-xhr-channel', () => ({
	sendSyncXhr: (...args: unknown[]) => mockSendSyncXhr(...args),
}));

beforeEach(() => {
	vi.clearAllMocks();
	PolyfillProxyWebSocket.sockfdToSocketId.clear();
	PolyfillProxyWebSocket.lastCreatedSocketId = 0;
	PolyfillProxyWebSocket.onSocketClosed = null;

	// Default: sock-open succeeds.
	mockSendSyncXhr.mockReturnValue({
		ok: true,
		data: new Uint8Array(0),
	});
});

describe('PolyfillProxyWebSocket', () => {
	describe('constructor', () => {
		it('opens a socket via sync XHR with parsed host and port', () => {
			const ws = new PolyfillProxyWebSocket(
				'ws://playground.internal/?host=example.com&port=443'
			);
			expect(ws.readyState).toBe(1); // OPEN
			expect(mockSendSyncXhr).toHaveBeenCalledWith(
				'sock-open',
				expect.objectContaining({
					host: 'example.com',
					port: '443',
				})
			);
		});

		it('sets readyState to CLOSED when sock-open fails', () => {
			mockSendSyncXhr.mockReturnValue({
				ok: false,
				data: new Uint8Array(0),
			});
			const ws = new PolyfillProxyWebSocket(
				'ws://playground.internal/?host=bad&port=0'
			);
			expect(ws.readyState).toBe(3); // CLOSED
		});

		it('assigns unique socket IDs', () => {
			const ws1 = new PolyfillProxyWebSocket(
				'ws://playground.internal/?host=a&port=1'
			);
			const ws2 = new PolyfillProxyWebSocket(
				'ws://playground.internal/?host=b&port=2'
			);
			expect(ws1.socketId).not.toBe(ws2.socketId);
		});

		it('sets lastCreatedSocketId for sockfd mapping', () => {
			const ws = new PolyfillProxyWebSocket(
				'ws://playground.internal/?host=a&port=1'
			);
			expect(PolyfillProxyWebSocket.lastCreatedSocketId).toBe(
				ws.socketId
			);
		});
	});

	describe('WebSocket state constants', () => {
		it('has standard WebSocket readyState constants', () => {
			const ws = new PolyfillProxyWebSocket(
				'ws://playground.internal/?host=a&port=1'
			);
			expect(ws.CONNECTING).toBe(0);
			expect(ws.OPEN).toBe(1);
			expect(ws.CLOSING).toBe(2);
			expect(ws.CLOSED).toBe(3);
		});

		it('readyState matches instance OPEN constant', () => {
			const ws = new PolyfillProxyWebSocket(
				'ws://playground.internal/?host=a&port=1'
			);
			expect(ws.readyState).toBe(ws.OPEN);
		});
	});

	describe('send', () => {
		it('sends data via sync XHR when OPEN', () => {
			const ws = new PolyfillProxyWebSocket(
				'ws://playground.internal/?host=a&port=1'
			);
			const data = new ArrayBuffer(3);
			new Uint8Array(data).set([1, 2, 3]);
			ws.send(data);

			expect(mockSendSyncXhr).toHaveBeenCalledWith(
				'sock-send',
				{ socketId: ws.socketId },
				new Uint8Array([1, 2, 3])
			);
		});

		it('does not send when readyState is not OPEN', () => {
			mockSendSyncXhr.mockReturnValue({
				ok: false,
				data: new Uint8Array(0),
			});
			const ws = new PolyfillProxyWebSocket(
				'ws://playground.internal/?host=a&port=1'
			);
			// readyState is CLOSED (3)

			mockSendSyncXhr.mockClear();
			ws.send(new ArrayBuffer(1));
			expect(mockSendSyncXhr).not.toHaveBeenCalled();
		});
	});

	describe('close', () => {
		it('sends sock-close and sets readyState to CLOSED', () => {
			const ws = new PolyfillProxyWebSocket(
				'ws://playground.internal/?host=a&port=1'
			);
			ws.close();

			expect(ws.readyState).toBe(3); // CLOSED
			expect(mockSendSyncXhr).toHaveBeenCalledWith('sock-close', {
				socketId: ws.socketId,
			});
		});

		it('is a no-op when already CLOSED', () => {
			const ws = new PolyfillProxyWebSocket(
				'ws://playground.internal/?host=a&port=1'
			);
			ws.close();
			mockSendSyncXhr.mockClear();
			ws.close();
			expect(mockSendSyncXhr).not.toHaveBeenCalled();
		});

		it('cleans up sockfdToSocketId mapping', () => {
			const ws = new PolyfillProxyWebSocket(
				'ws://playground.internal/?host=a&port=1'
			);
			// Simulate the __syscall_connect wrapper setting
			// the FD mapping.
			PolyfillProxyWebSocket.sockfdToSocketId.set(5, ws.socketId);

			ws.close();
			expect(PolyfillProxyWebSocket.sockfdToSocketId.has(5)).toBe(false);
		});

		it('does not remove unrelated FD mappings', () => {
			const ws = new PolyfillProxyWebSocket(
				'ws://playground.internal/?host=a&port=1'
			);
			// Map FD 5 to this socket, FD 6 to another.
			PolyfillProxyWebSocket.sockfdToSocketId.set(5, ws.socketId);
			PolyfillProxyWebSocket.sockfdToSocketId.set(6, 999);

			ws.close();
			expect(PolyfillProxyWebSocket.sockfdToSocketId.has(6)).toBe(true);
		});

		it('invokes onSocketClosed callback', () => {
			const callback = vi.fn();
			PolyfillProxyWebSocket.onSocketClosed = callback;

			const ws = new PolyfillProxyWebSocket(
				'ws://playground.internal/?host=a&port=1'
			);
			ws.close();

			expect(callback).toHaveBeenCalledWith(ws.socketId);
		});
	});

	describe('event handler stubs', () => {
		it('has no-op addEventListener and removeEventListener', () => {
			const ws = new PolyfillProxyWebSocket(
				'ws://playground.internal/?host=a&port=1'
			);
			expect(() => ws.addEventListener()).not.toThrow();
			expect(() => ws.removeEventListener()).not.toThrow();
		});

		it('has null event handler properties', () => {
			const ws = new PolyfillProxyWebSocket(
				'ws://playground.internal/?host=a&port=1'
			);
			expect(ws.onopen).toBeNull();
			expect(ws.onclose).toBeNull();
			expect(ws.onerror).toBeNull();
			expect(ws.onmessage).toBeNull();
		});
	});
});
