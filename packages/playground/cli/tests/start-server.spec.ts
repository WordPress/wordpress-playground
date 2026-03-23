import { describe, it, expect, vi, beforeAll, type Mock } from 'vitest';
import http from 'http';
import https from 'https';
import http2 from 'http2';
import { pipeline } from 'stream/promises';
import type { PHPRequest } from '@php-wasm/universal';
import { StreamedPHPResponse } from '@php-wasm/universal';
import { startServer } from '../src/start-server';
import { generateSelfSignedCert, type TlsCertificate } from '../src/tls';
import { logger } from '@php-wasm/logger';
import type StreamPromisesModule from 'stream/promises';

vi.mock('@php-wasm/logger', () => ({
	logger: { log: vi.fn(), error: vi.fn() },
}));

vi.mock('stream/promises', async (importOriginal) => {
	const actual = await importOriginal<typeof StreamPromisesModule>();
	return { ...actual, pipeline: vi.fn(actual.pipeline) };
});

function makeOkResponse(body: string): StreamedPHPResponse {
	return new StreamedPHPResponse(
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
				controller.enqueue(new TextEncoder().encode(body));
				controller.close();
			},
		}),
		new ReadableStream({ start: (c) => c.close() }),
		Promise.resolve(0)
	);
}

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

describe('startServer with HTTP/2', () => {
	let tlsCert: TlsCertificate;

	beforeAll(() => {
		tlsCert = generateSelfSignedCert();
	});

	function h2Request(
		port: number,
		path: string
	): Promise<{ status: number; body: string }> {
		return new Promise((resolve, reject) => {
			const client = http2.connect(`https://127.0.0.1:${port}`, {
				rejectUnauthorized: false,
			});
			client.on('error', reject);
			const req = client.request({ ':path': path });
			let body = '';
			let status = 0;
			req.on('response', (headers) => {
				status = headers[':status'] as number;
			});
			req.on('data', (chunk: Buffer) => {
				body += chunk.toString();
			});
			req.on('end', () => {
				client.close();
				resolve({ status, body });
			});
			req.on('error', reject);
			req.end();
		});
	}

	function startH2Server(
		handleRequest: (request: PHPRequest) => Promise<StreamedPHPResponse>
	) {
		return startServer({
			port: 0,
			http2: true,
			tlsCertificate: tlsCert,
			handleRequest,
			async onBind(server, port) {
				return { server, port } as any;
			},
		});
	}

	it('starts and responds to HTTP/2 requests', async () => {
		const cliServer = await startH2Server(async () =>
			makeOkResponse('h2 works')
		);
		const { server, port } = cliServer as any;

		try {
			const { status, body } = await h2Request(port, '/');
			expect(status).toBe(200);
			expect(body).toBe('h2 works');
		} finally {
			server.close();
			(server as any).closeAllConnections();
		}
	});

	it('passes protocolVersion HTTP/2.0 to handleRequest', async () => {
		let capturedRequest: PHPRequest | undefined;
		const cliServer = await startH2Server(async (req) => {
			capturedRequest = req;
			return makeOkResponse('ok');
		});
		const { server, port } = cliServer as any;

		try {
			await h2Request(port, '/test');
			expect(capturedRequest).toBeDefined();
			expect(capturedRequest!.protocolVersion).toBe('HTTP/2.0');
		} finally {
			server.close();
			(server as any).closeAllConnections();
		}
	});

	it('filters HTTP/2 pseudo-headers from request', async () => {
		let capturedRequest: PHPRequest | undefined;
		const cliServer = await startH2Server(async (req) => {
			capturedRequest = req;
			return makeOkResponse('ok');
		});
		const { server, port } = cliServer as any;

		try {
			await h2Request(port, '/test');
			expect(capturedRequest).toBeDefined();
			const pseudoHeaders = Object.keys(
				capturedRequest!.headers ?? {}
			).filter((k) => k.startsWith(':'));
			expect(pseudoHeaders).toHaveLength(0);
		} finally {
			server.close();
			(server as any).closeAllConnections();
		}
	});

	it('includes host header with no pseudo-headers leaking', async () => {
		let capturedRequest: PHPRequest | undefined;
		const cliServer = await startServer({
			port: 0,
			http2: true,
			tlsCertificate: tlsCert,
			handleRequest: async (req) => {
				capturedRequest = req;
				return makeOkResponse('ok');
			},
			async onBind(server, port) {
				return { server, port } as any;
			},
		});
		const { server, port } = cliServer as any;

		try {
			// Send a request with an explicit host-like header
			await new Promise<void>((resolve, reject) => {
				const client = http2.connect(`https://127.0.0.1:${port}`, {
					rejectUnauthorized: false,
				});
				client.on('error', reject);
				const req = client.request({
					':path': '/',
					':method': 'GET',
				});
				req.on('response', () => {});
				req.on('data', () => {});
				req.on('end', () => {
					client.close();
					resolve();
				});
				req.on('error', reject);
				req.end();
			});
			expect(capturedRequest).toBeDefined();
			// Pseudo-headers must not leak through to PHP
			const headerKeys = Object.keys(capturedRequest!.headers ?? {});
			expect(headerKeys.filter((k) => k.startsWith(':'))).toHaveLength(0);
		} finally {
			server.close();
			(server as any).closeAllConnections();
		}
	});

	it('supports HTTP/1.1 fallback via allowHTTP1', async () => {
		let capturedRequest: PHPRequest | undefined;
		const cliServer = await startH2Server(async (req) => {
			capturedRequest = req;
			return makeOkResponse('h1 fallback');
		});
		const { server, port } = cliServer as any;

		try {
			const body = await new Promise<string>((resolve, reject) => {
				const req = https.get(
					`https://127.0.0.1:${port}/`,
					{ rejectUnauthorized: false },
					(res) => {
						let data = '';
						res.on('data', (chunk: Buffer) => {
							data += chunk.toString();
						});
						res.on('end', () => resolve(data));
					}
				);
				req.on('error', reject);
			});
			expect(body).toBe('h1 fallback');
			expect(capturedRequest).toBeDefined();
			expect(capturedRequest!.protocolVersion).toBe('HTTP/1.1');
		} finally {
			server.close();
			(server as any).closeAllConnections();
		}
	});

	it('throws when HTTP/2 is requested without TLS certificate', async () => {
		await expect(
			startServer({
				port: 0,
				http2: true,
				handleRequest: async () => makeOkResponse('nope'),
				async onBind(server, port) {
					return { server, port } as any;
				},
			})
		).rejects.toThrow('TLS certificate is required for HTTP/2.');
	});
});
