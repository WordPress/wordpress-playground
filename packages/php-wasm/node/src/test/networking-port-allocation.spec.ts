import http from 'node:http';
import net from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withNetworking } from '../lib/networking/with-networking';
import { addTCPServerToWebSocketServerClass } from '../lib/networking/inbound-tcp-to-ws-proxy';
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
});
