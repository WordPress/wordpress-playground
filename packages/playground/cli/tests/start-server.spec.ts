import { describe, it, expect, vi } from 'vitest';
import http from 'http';
import { StreamedPHPResponse } from '@php-wasm/universal';
import { startServer } from '../src/start-server';
import { logger } from '@php-wasm/logger';

vi.mock('@php-wasm/logger', () => ({
	logger: { error: vi.fn() },
}));

describe('startServer', () => {
	it('does not log an error on client disconnect', async () => {
		const error = new Error('handler failure');
		const handlers = [
			// First request returns a streaming response.
			async () =>
				new StreamedPHPResponse(
					new ReadableStream({
						start(controller) {
							const json = JSON.stringify({
								status: 200,
								headers: ['content-type: text/plain'],
							});
							controller.enqueue(new TextEncoder().encode(json));
							controller.close();
						},
					}),
					new ReadableStream({
						start(controller) {
							controller.enqueue(
								new TextEncoder().encode('hello')
							);
						},
					}),
					new ReadableStream({ start: (c) => c.close() }),
					Promise.resolve(0)
				),
			// Second request throws to verify error logging works.
			async () => {
				throw error;
			},
		];

		const cliServer = await startServer({
			port: 0,
			handleRequest: () => handlers.shift()!(),
			async onBind(server, port) {
				return { server, port } as any;
			},
		});
		const { server, port } = cliServer as any;

		try {
			// First request: client disconnects mid-stream.
			await new Promise<void>((resolve) => {
				const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
					res.once('data', () => {
						req.destroy();
						resolve();
					});
				});
			});
			await new Promise((r) => setTimeout(r, 200));
			expect(logger.error).not.toHaveBeenCalled();

			// Second request: handler throws to prove error logging works.
			await new Promise<void>((resolve) => {
				http.get(`http://127.0.0.1:${port}/`, (res) => {
					res.resume();
					res.on('end', () => resolve());
				});
			});
			expect(logger.error).toHaveBeenCalledWith(error);
		} finally {
			server.close();
		}
	});
});
