import http from 'node:http';
import { EventEmitter, once } from 'node:events';
import net from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withNetworking } from '../lib/networking/with-networking';
import {
	addTCPServerToWebSocketServerClass,
	listenTCPToWSProxy,
} from '../lib/networking/inbound-tcp-to-ws-proxy';
import { getServerPort } from '../lib/networking/utils';

describe('networking port allocation', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('binds the outbound websocket proxy directly on an automatic port', async () => {
		const originalListen = http.Server.prototype.listen;
		const listenCalls: unknown[][] = [];
		const listenSpy = vi
			.spyOn(http.Server.prototype, 'listen')
			.mockImplementation(function (
				this: http.Server,
				...args: Parameters<typeof http.Server.prototype.listen>
			) {
				listenCalls.push(args);
				return originalListen.apply(this, args);
			});

		const emscriptenOptions = await withNetworking({});
		const server =
			emscriptenOptions.outboundNetworkProxyServer as http.Server;

		try {
			expect(listenCalls).toContainEqual([
				0,
				'127.0.0.1',
				expect.any(Function),
			]);
			expect(
				emscriptenOptions['websocket']?.url(null, 'example.com', '80')
			).toContain(`127.0.0.1:${getServerPort(server)}`);
			expect(listenSpy).toHaveBeenCalled();
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('does not open an outbound target after the websocket closes during DNS lookup', async () => {
		let lookupCallback:
			| ((
					error: NodeJS.ErrnoException | null,
					address: string,
					family: number
			  ) => void)
			| undefined;
		const lookup = vi.fn(
			(
				_hostname: string,
				_options: unknown,
				callback: (
					error: NodeJS.ErrnoException | null,
					address: string,
					family: number
				) => void
			) => {
				lookupCallback = callback;
				return {};
			}
		);
		vi.resetModules();
		vi.doMock('dns', () => ({ lookup }));
		const { initOutboundWebsocketProxyServer } =
			await import('../lib/networking/outbound-ws-to-tcp-proxy');
		const targetServer = net.createServer();
		const targetConnections: net.Socket[] = [];
		targetServer.on('connection', (socket) => {
			targetConnections.push(socket);
		});
		await new Promise<void>((resolve) => {
			targetServer.listen(0, '127.0.0.1', resolve);
		});
		const proxyServer = await initOutboundWebsocketProxyServer(0);
		const client = new WebSocket(
			`ws://127.0.0.1:${getServerPort(proxyServer)}/?host=example.test&port=${getServerPort(
				targetServer
			)}`
		);

		try {
			await waitFor(() => lookupCallback !== undefined);
			forceCloseWebSocket(client);
			await new Promise((resolve) => setTimeout(resolve, 25));
			lookupCallback!(null, '127.0.0.1', 4);
			await new Promise((resolve) => setTimeout(resolve, 25));

			expect(lookup).toHaveBeenCalled();
			expect(targetConnections).toHaveLength(0);
		} finally {
			forceCloseWebSocket(client);
			targetConnections.forEach((socket) => socket.destroy());
			await new Promise((resolve) => targetServer.close(resolve));
			await new Promise((resolve) => proxyServer.close(resolve));
			vi.doUnmock('dns');
			vi.resetModules();
		}
	});

	it('does not report outbound DNS failures after the websocket closes', async () => {
		let lookupCallback:
			| ((
					error: NodeJS.ErrnoException | null,
					address: string,
					family: number
			  ) => void)
			| undefined;
		const lookup = vi.fn(
			(
				_hostname: string,
				_options: unknown,
				callback: (
					error: NodeJS.ErrnoException | null,
					address: string,
					family: number
				) => void
			) => {
				lookupCallback = callback;
				return {};
			}
		);
		vi.resetModules();
		vi.doMock('dns', () => ({ lookup }));
		const { initOutboundWebsocketProxyServer } =
			await import('../lib/networking/outbound-ws-to-tcp-proxy');
		const proxyServer = await initOutboundWebsocketProxyServer(0);
		const client = new WebSocket(
			`ws://127.0.0.1:${getServerPort(
				proxyServer
			)}/?host=example.test&port=80`
		);

		try {
			await waitFor(() => lookupCallback !== undefined);
			forceCloseWebSocket(client);
			await new Promise((resolve) => setTimeout(resolve, 25));
			const lookupError = new Error(
				'DNS failed'
			) as NodeJS.ErrnoException;
			lookupError.code = 'ENOTFOUND';
			lookupCallback!(lookupError, '', 0);
			await new Promise((resolve) => setTimeout(resolve, 25));

			expect(lookup).toHaveBeenCalled();
		} finally {
			forceCloseWebSocket(client);
			await new Promise((resolve) => proxyServer.close(resolve));
			vi.doUnmock('dns');
			vi.resetModules();
		}
	});

	it('closes outbound clients instead of exiting on unknown commands', async () => {
		const { initOutboundWebsocketProxyServer } =
			await import('../lib/networking/outbound-ws-to-tcp-proxy');
		const targetServer = net.createServer((socket) => {
			socket.on('error', () => {});
		});
		await new Promise<void>((resolve) => {
			targetServer.listen(0, '127.0.0.1', resolve);
		});
		const proxyServer = await initOutboundWebsocketProxyServer(0);
		const client = new WebSocket(
			`ws://127.0.0.1:${getServerPort(
				proxyServer
			)}/?host=127.0.0.1&port=${getServerPort(targetServer)}`
		);
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
			code?: number | string | null
		) => {
			throw new Error(`process.exit unexpectedly called with "${code}"`);
		}) as any);

		try {
			await once(client, 'open');
			const closePromise = once(client, 'close');
			client.send(new Uint8Array([0xff]));

			await closePromise;
			expect(exitSpy).not.toHaveBeenCalled();
		} finally {
			forceCloseWebSocket(client);
			await new Promise((resolve) => targetServer.close(resolve));
			await new Promise((resolve) => proxyServer.close(resolve));
		}
	});

	it('rejects non-integer outbound target ports before opening a socket', async () => {
		const { initOutboundWebsocketProxyServer } =
			await import('../lib/networking/outbound-ws-to-tcp-proxy');
		const targetServer = net.createServer();
		const targetConnections: net.Socket[] = [];
		targetServer.on('connection', (socket) => {
			targetConnections.push(socket);
		});
		await new Promise<void>((resolve) => {
			targetServer.listen(0, '127.0.0.1', resolve);
		});
		const proxyServer = await initOutboundWebsocketProxyServer(0);
		const client = new WebSocket(
			`ws://127.0.0.1:${getServerPort(
				proxyServer
			)}/?host=127.0.0.1&port=1.5`
		);

		try {
			await once(client, 'open');
			await once(client, 'close');

			expect(targetConnections).toHaveLength(0);
		} finally {
			forceCloseWebSocket(client);
			targetConnections.forEach((socket) => socket.destroy());
			await new Promise((resolve) => targetServer.close(resolve));
			await new Promise((resolve) => proxyServer.close(resolve));
		}
	});

	it('keeps outbound proxy server errors handled after startup', async () => {
		const { initOutboundWebsocketProxyServer } =
			await import('../lib/networking/outbound-ws-to-tcp-proxy');
		const proxyServer = await initOutboundWebsocketProxyServer(0);

		try {
			expect(() =>
				proxyServer.emit('error', new Error('runtime server error'))
			).not.toThrow();
		} finally {
			await new Promise((resolve) => proxyServer.close(resolve));
		}
	});

	it('binds the inbound websocket proxy directly on an automatic port', async () => {
		class StubWebSocketServer extends EventTarget {
			private readonly port = 43210;
			public options: { port: number };

			constructor(options: { port: number }) {
				super();
				this.options = options;
				process.nextTick(() =>
					this.dispatchEvent(new Event('listening'))
				);
			}

			once(event: string, callback: () => void) {
				this.addEventListener(event, callback, { once: true });
			}

			close(callback?: () => void) {
				callback?.();
			}

			address() {
				return {
					address: '127.0.0.1',
					family: 'IPv4',
					port: this.port,
				};
			}
		}

		let closeCalled = false;
		const listenCalls: unknown[][] = [];
		const listenSpy = vi
			.spyOn(net.Server.prototype, 'listen')
			.mockImplementation(function (
				this: net.Server,
				...args: Parameters<typeof net.Server.prototype.listen>
			) {
				listenCalls.push(args);
				Object.defineProperty(this, 'listening', {
					value: true,
					configurable: true,
				});
				process.nextTick(() => {
					const callback = [...args]
						.reverse()
						.find(
							(arg): arg is () => void =>
								typeof arg === 'function'
						);
					callback?.();
					this.emit('listening');
				});
				return this;
			});
		const closeSpy = vi
			.spyOn(net.Server.prototype, 'close')
			.mockImplementation(function (this: net.Server) {
				closeCalled = true;
				return this;
			});

		const DecoratedServer = addTCPServerToWebSocketServerClass(
			StubWebSocketServer as any
		);
		const onListening = vi.fn(function (this: unknown) {
			expect(this).toBe(websocketServer);
		});
		const websocketServer = new DecoratedServer(
			{ port: 12345 },
			onListening
		);

		await new Promise((resolve) => process.nextTick(resolve));
		await new Promise((resolve) => process.nextTick(resolve));

		try {
			expect(websocketServer.options.port).toBe(0);
			expect(listenCalls).toContainEqual([12345, expect.any(Function)]);
			expect(onListening).toHaveBeenCalledOnce();
			websocketServer.close();
			expect(closeCalled).toBe(true);
			expect(listenSpy).toHaveBeenCalled();
		} finally {
			listenSpy.mockRestore();
			closeSpy.mockRestore();
		}
	});

	it('does not leave an inbound TCP proxy behind when the server closes before listening', async () => {
		class StubWebSocketServer extends EventTarget {
			constructor() {
				super();
				process.nextTick(() =>
					this.dispatchEvent(new Event('listening'))
				);
			}

			once(event: string, callback: () => void) {
				this.addEventListener(event, callback, { once: true });
			}

			close(callback?: () => void) {
				callback?.();
			}

			address() {
				return {
					address: '127.0.0.1',
					family: 'IPv4',
					port: 43210,
				};
			}
		}

		const listenSpy = vi
			.spyOn(net.Server.prototype, 'listen')
			.mockImplementation(function (this: net.Server) {
				return this;
			});
		const DecoratedServer = addTCPServerToWebSocketServerClass(
			StubWebSocketServer as any
		);
		const websocketServer = new DecoratedServer({ port: 12345 }, vi.fn());

		websocketServer.close();
		await new Promise((resolve) => process.nextTick(resolve));
		await new Promise((resolve) => process.nextTick(resolve));

		expect(listenSpy).not.toHaveBeenCalled();
	});

	it('waits for the inbound TCP proxy to close before running the close callback', async () => {
		class StubWebSocketServer extends EventTarget {
			constructor() {
				super();
				process.nextTick(() =>
					this.dispatchEvent(new Event('listening'))
				);
			}

			once(event: string, callback: () => void) {
				this.addEventListener(event, callback, { once: true });
			}

			close(callback?: () => void) {
				callback?.();
			}

			address() {
				return {
					address: '127.0.0.1',
					family: 'IPv4',
					port: 43210,
				};
			}
		}

		let tcpCloseCallback: (() => void) | undefined;
		const listenSpy = vi
			.spyOn(net.Server.prototype, 'listen')
			.mockImplementation(function (
				this: net.Server,
				...args: Parameters<typeof net.Server.prototype.listen>
			) {
				Object.defineProperty(this, 'listening', {
					value: true,
					configurable: true,
				});
				process.nextTick(() => {
					const callback = [...args]
						.reverse()
						.find(
							(arg): arg is () => void =>
								typeof arg === 'function'
						);
					callback?.();
					this.emit('listening');
				});
				return this;
			});
		const closeSpy = vi
			.spyOn(net.Server.prototype, 'close')
			.mockImplementation(function (
				this: net.Server,
				callback?: () => void
			) {
				tcpCloseCallback = callback;
				return this;
			});

		const DecoratedServer = addTCPServerToWebSocketServerClass(
			StubWebSocketServer as any
		);
		const websocketServer = new DecoratedServer({ port: 12345 }, vi.fn());
		await new Promise((resolve) => process.nextTick(resolve));
		await new Promise((resolve) => process.nextTick(resolve));

		try {
			const onClose = vi.fn();
			websocketServer.close(onClose);

			expect(onClose).not.toHaveBeenCalled();
			tcpCloseCallback?.();
			expect(onClose).toHaveBeenCalledOnce();
		} finally {
			listenSpy.mockRestore();
			closeSpy.mockRestore();
		}
	});

	it('surfaces inbound TCP proxy listen errors through the websocket server', async () => {
		const listenError = new Error('port already in use');

		class StubWebSocketServer extends EventEmitter {
			constructor() {
				super();
				process.nextTick(() => this.emit('listening'));
			}

			close(callback?: () => void) {
				callback?.();
			}

			address() {
				return {
					address: '127.0.0.1',
					family: 'IPv4',
					port: 43210,
				};
			}
		}

		const listenSpy = vi
			.spyOn(net.Server.prototype, 'listen')
			.mockImplementation(function (this: net.Server) {
				process.nextTick(() => this.emit('error', listenError));
				return this;
			});
		const DecoratedServer = addTCPServerToWebSocketServerClass(
			StubWebSocketServer as any
		);
		const onListening = vi.fn();
		const websocketServer = new DecoratedServer(
			{ port: 12345 },
			onListening
		);
		const errorPromise = new Promise((resolve) =>
			websocketServer.once('error', resolve)
		);

		await expect(errorPromise).resolves.toBe(listenError);
		expect(onListening).not.toHaveBeenCalled();
		expect(listenSpy).toHaveBeenCalled();
	});

	it('closes inbound TCP connections when the websocket target fails', async () => {
		const reservedPortServer = net.createServer();
		await new Promise<void>((resolve) => {
			reservedPortServer.listen(0, '127.0.0.1', resolve);
		});
		const unavailableWsPort = getServerPort(reservedPortServer);
		await new Promise((resolve) => reservedPortServer.close(resolve));

		const proxyServer = listenTCPToWSProxy({
			tcpListenPort: 0,
			wsConnectPort: unavailableWsPort,
		});
		await once(proxyServer, 'listening');
		const tcpClient = net.createConnection({
			host: '127.0.0.1',
			port: getServerPort(proxyServer),
		});
		tcpClient.on('error', () => {});

		try {
			const closePromise = once(tcpClient, 'close');
			tcpClient.write('hello');
			await closePromise;
		} finally {
			tcpClient.destroy();
			await new Promise((resolve) => proxyServer.close(resolve));
		}
	});

	it('keeps inbound proxy server errors handled after startup', async () => {
		const proxyServer = listenTCPToWSProxy({
			tcpListenPort: 0,
			wsConnectPort: 1,
		});
		await once(proxyServer, 'listening');

		try {
			expect(() =>
				proxyServer.emit('error', new Error('runtime server error'))
			).not.toThrow();
		} finally {
			await new Promise((resolve) => proxyServer.close(resolve));
		}
	});
});

async function waitFor(predicate: () => boolean) {
	const timeoutAt = Date.now() + 1000;
	while (!predicate()) {
		if (Date.now() > timeoutAt) {
			throw new Error('Timed out waiting for condition.');
		}
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

function forceCloseWebSocket(client: WebSocket) {
	client.close();
	(client as unknown as { _socket?: net.Socket })._socket?.destroy();
}
