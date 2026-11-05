import net from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withNetworking } from '../lib/networking/with-networking';
import { addTCPServerToWebSocketServerClass } from '../lib/networking/inbound-tcp-to-ws-proxy';

describe('networking port allocation', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('does not listen on a port for outbound connections', async () => {
		const listenSpy = vi.spyOn(net.Server.prototype, 'listen');

		const emscriptenOptions = await withNetworking({});
		const OutboundSocket = emscriptenOptions['websocket'].decorator();
		const socket = new OutboundSocket(
			emscriptenOptions['websocket'].url(null, '127.0.0.1', '9')
		);
		socket.close();

		expect(listenSpy).not.toHaveBeenCalled();
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
