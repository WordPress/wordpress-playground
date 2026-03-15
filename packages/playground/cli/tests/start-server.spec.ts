import { describe, it, expect, vi, type Mock } from 'vitest';
import http from 'http';
import { pipeline } from 'stream/promises';
import { StreamedPHPResponse } from '@php-wasm/universal';
import { startServer } from '../src/start-server';
import { logger } from '@php-wasm/logger';
import type StreamPromisesModule from 'stream/promises';

vi.mock('@php-wasm/logger', () => ({
	logger: { error: vi.fn() },
}));

vi.mock('stream/promises', async (importOriginal) => {
	const actual = await importOriginal<typeof StreamPromisesModule>();
	return { ...actual, pipeline: vi.fn(actual.pipeline) };
});

describe('startServer', () => {
	it('does not log an error when piping to a destroyed stream (ERR_STREAM_UNABLE_TO_PIPE)', async () => {
		const pipelineMock = vi.mocked(pipeline);
		pipelineMock.mockClear();
		(logger.error as Mock<typeof logger.error>).mockClear();

		const expectedErrorBefore = new Error('handler failure before');
		const expectedErrorAfter = new Error('handler failure after');
		const unableToPipeError = Object.assign(
			new Error('Cannot pipe to a closed or destroyed stream'),
			{ code: 'ERR_STREAM_UNABLE_TO_PIPE' }
		);

		const repondersForHandleRequest = [
			// Demonstrate logged error before the ignored error
			// to confirm the logger was working beforehand.
			async () => {
				throw expectedErrorBefore;
			},
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
							controller.close();
						},
					}),
					new ReadableStream({ start: (c) => c.close() }),
					Promise.resolve(0)
				),
			// Demonstrate logged error after the ignored error
			// to confirm the logger was working afterward.
			async () => {
				throw expectedErrorAfter;
			},
		];

		// Mock pipeline to reject with ERR_STREAM_UNABLE_TO_PIPE,
		// simulating what happens when the response stream is already
		// destroyed before pipeline() is called.
		pipelineMock.mockRejectedValueOnce(unableToPipeError);

		const cliServer = await startServer({
			port: 0,
			handleRequest: () => repondersForHandleRequest.shift()!(),
			async onBind(server, port) {
				return { server, port } as any;
			},
		});
		const { server, port } = cliServer as any;

		try {
			// Demonstrate that error logging is working before the test.
			await new Promise<void>((resolve) => {
				http.get(`http://127.0.0.1:${port}/`, (res) => {
					res.resume();
					res.on('end', () => resolve());
				});
			});
			expect(logger.error).toHaveBeenCalledWith(expectedErrorBefore);
			(logger.error as Mock<typeof logger.error>).mockClear();

			// Make a request. The mocked pipeline will reject, so the
			// response won't complete – ignore the client-side error.
			const req = http.get(`http://127.0.0.1:${port}/`);
			req.on('error', () => {});
			await new Promise((r) => setTimeout(r, 200));
			req.destroy();

			// Confirm the ERR_STREAM_UNABLE_TO_PIPE error was
			// actually produced by the pipeline call.
			expect(pipelineMock).toHaveBeenCalled();
			const pipelineResult = pipelineMock.mock.results[0];
			expect(pipelineResult.type).toBe('return');
			const pipelineError = await (
				pipelineResult.value as Promise<void>
			).catch((e: Error) => e);
			expect(pipelineError).toBeInstanceOf(Error);
			expect((pipelineError as NodeJS.ErrnoException).code).toBe(
				'ERR_STREAM_UNABLE_TO_PIPE'
			);

			// Confirm the error was NOT logged.
			expect(logger.error).not.toHaveBeenCalled();

			// Demonstrate that error logging remains working after the test.
			await new Promise<void>((resolve) => {
				http.get(`http://127.0.0.1:${port}/`, (res) => {
					res.resume();
					res.on('end', () => resolve());
				});
			});
			expect(logger.error).toHaveBeenCalledWith(expectedErrorAfter);
		} finally {
			server.close();
		}
	});

	it('does not log an error on client disconnect (ERR_STREAM_PREMATURE_CLOSE)', async () => {
		const pipelineMock = vi.mocked(pipeline);
		pipelineMock.mockClear();
		(logger.error as Mock<typeof logger.error>).mockClear();

		const expectedErrorBefore = new Error('handler failure before');
		const expectedErrorAfter = new Error('handler failure after');

		const repondersForHandleRequest = [
			// Demonstrate logged error before the ignored error
			// to confirm the logger was working beforehand.
			async () => {
				throw expectedErrorBefore;
			},
			// Provide a real streamed response so we can test what happens
			// when the client disconnects mid-stream.
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
			// Demonstrate logged error after the ignored error
			// to confirm the logger was working afterward.
			async () => {
				throw expectedErrorAfter;
			},
		];

		const cliServer = await startServer({
			port: 0,
			// Each time handleRequest is called,
			// move on to the next responder in the list.
			handleRequest: () => repondersForHandleRequest.shift()!(),
			async onBind(server, port) {
				return { server, port } as any;
			},
		});
		const { server, port } = cliServer as any;

		try {
			// Demonstrate that error logging is working before the client disconnect test.
			await new Promise<void>((resolve) => {
				http.get(`http://127.0.0.1:${port}/`, (res) => {
					res.resume();
					res.on('end', () => resolve());
				});
			});
			expect(logger.error).toHaveBeenCalledWith(expectedErrorBefore);
			(logger.error as Mock<typeof logger.error>).mockClear();

			// Test what happens when the client disconnects mid-stream.
			await new Promise<void>((resolve) => {
				const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
					res.once('data', () => {
						req.destroy();
						resolve();
					});
				});
			});
			await new Promise((r) => setTimeout(r, 200));

			// Confirm the ERR_STREAM_PREMATURE_CLOSE error was
			// actually produced by the pipeline call.
			const pipelineMock = vi.mocked(pipeline);
			expect(pipelineMock).toHaveBeenCalled();
			const pipelineResult = pipelineMock.mock.results[0];
			expect(pipelineResult.type).toBe('return');
			const pipelineError = await (
				pipelineResult.value as Promise<void>
			).catch((e: Error) => e);
			expect(pipelineError).toBeInstanceOf(Error);
			expect((pipelineError as NodeJS.ErrnoException).code).toBe(
				'ERR_STREAM_PREMATURE_CLOSE'
			);

			// Confirm the error was NOT logged.
			expect(logger.error).not.toHaveBeenCalled();

			// Demonstrate that error logging remains working after the client disconnect test.
			await new Promise<void>((resolve) => {
				http.get(`http://127.0.0.1:${port}/`, (res) => {
					res.resume();
					res.on('end', () => resolve());
				});
			});
			expect(logger.error).toHaveBeenCalledWith(expectedErrorAfter);
		} finally {
			server.close();
		}
	});
});
