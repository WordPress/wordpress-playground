import http from 'node:http';
import net from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withNetworking } from '../lib/networking/with-networking';
import { addTCPServerToWebSocketServerClass } from '../lib/networking/inbound-tcp-to-ws-proxy';

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
			expect(listenCalls).toContainEqual(
				expect.arrayContaining([0, '127.0.0.1'])
			);
			expect(
				emscriptenOptions['websocket']?.url(null, 'example.com', '80')
			).toContain(
				`127.0.0.1:${(server.address() as { port: number }).port}`
			);
			expect(listenSpy).toHaveBeenCalled();
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('binds the inbound websocket proxy directly on an automatic port', async () => {
		class StubWebSocketServer extends EventTarget {
			private readonly port = 43210;

			constructor(public options: { port: number }) {
				super();
				process.nextTick(() =>
					this.dispatchEvent(new Event('listening'))
				);
			}

			once(event: string, callback: () => void) {
				this.addEventListener(event, callback, { once: true });
			}

			address() {
				return {
					address: '127.0.0.1',
					family: 'IPv4',
					port: this.port,
				};
			}
		}

		const listenCalls: unknown[][] = [];
		const listenSpy = vi
			.spyOn(net.Server.prototype, 'listen')
			.mockImplementation(function (
				this: net.Server,
				...args: Parameters<typeof net.Server.prototype.listen>
			) {
				listenCalls.push(args);
				return this;
			});

		const DecoratedServer = addTCPServerToWebSocketServerClass(
			StubWebSocketServer as any
		);
		const websocketServer = new DecoratedServer({ port: 12345 }, () => {});

		await new Promise((resolve) => process.nextTick(resolve));

		try {
			expect(websocketServer.options.port).toBe(0);
			expect(listenCalls).toContainEqual(expect.arrayContaining([12345]));
			expect(listenSpy).toHaveBeenCalled();
		} finally {
			listenSpy.mockRestore();
		}
	});
});
