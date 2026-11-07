import net from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withNetworking } from '../lib/networking/with-networking';

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

	it('listens only on the host and port PHP binds to', async () => {
		const listenSpy = vi.spyOn(net.Server.prototype, 'listen');

		const emscriptenOptions = await withNetworking({});
		const Server = emscriptenOptions['websocket'].serverDecorator();
		const server = new Server({ host: '127.0.0.1', port: 0 });
		await new Promise((resolve) => server.once('listening', resolve));

		try {
			expect(listenSpy).toHaveBeenCalledOnce();
			expect(server.address()).toMatchObject({ address: '127.0.0.1' });
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});
});
