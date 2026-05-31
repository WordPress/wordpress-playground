import http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withNetworking } from '../lib/networking/with-networking';

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
});
