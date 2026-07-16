import { createServer, type Server } from 'node:http';
import { readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createPlaygroundProxy,
	createControlCredentials,
	NativeControlClient,
	NativePHPResponse,
	PHPExecutionFailureError,
} from '../src/control.js';

const openServers: Server[] = [];
afterEach(async () => {
	await Promise.all(
		openServers.splice(0).map((server) => {
			server.closeAllConnections();
			return new Promise<void>((resolve) =>
				server.close(() => resolve())
			);
		})
	);
});

describe('native control client', () => {
	it('creates its handshake inside a private temporary directory', async () => {
		const credentials = await createControlCredentials();
		const directory = dirname(credentials.handshakePath);
		try {
			expect(directory).toBe(credentials.handshakeDirectory);
			if (process.platform !== 'win32')
				expect((await stat(directory)).mode & 0o777).toBe(0o700);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('uses protocol v2, dispatches only known methods, and preserves native error codes', async () => {
		const received: Array<Record<string, unknown>> = [];
		const { client } = await controlServer(async (rpc) => {
			received.push(rpc);
			const params = rpc['params'] as Record<string, unknown>;
			if (rpc['method'] === 'absoluteUrl') return 'http://example.test';
			if (rpc['method'] === 'run') {
				const failed = params['code'] === '<?php exit(7);';
				return {
					exitCode: failed ? 7 : 0,
					httpStatusCode: failed ? 500 : 200,
					headers: [],
					stdout: tagged(failed ? 'bad stdout' : 'run output'),
					stderr: tagged(failed ? 'bad stderr' : ''),
				};
			}
			if (rpc['method'] === 'isFile') {
				return {
					error: {
						code: 'ERR_WP_PLAYGROUND_NATIVE_IO',
						message: 'filesystem secret unavailable',
					},
				};
			}
			if (rpc['method'] === 'listFiles') return ['z.php', 'a.php'];
			if (rpc['method'] === 'request') {
				const failed = params['path'] === '/exit';
				return {
					httpStatusCode: failed ? 500 : 200,
					headers: [{ name: 'Content-Type', value: 'text/plain' }],
					body: tagged(failed ? 'failed request' : 'hello'),
					stderr: tagged(failed ? 'request stderr' : ''),
					exitCode: failed ? 7 : 0,
				};
			}
			return null;
		});
		const playground = createPlaygroundProxy(client) as any;

		expect(await playground.absoluteUrl).toBe('http://example.test');
		const response = (await playground.request({
			url: '/',
			method: 'GET',
		})) as NativePHPResponse;
		expect(response.text).toBe('hello');
		expect(response.headers).toEqual({ 'content-type': ['text/plain'] });
		const failedRequest = (await playground.request({
			url: '/exit',
		})) as NativePHPResponse;
		expect(failedRequest).toMatchObject({
			exitCode: 7,
			errors: 'request stderr',
			httpStatusCode: 500,
		});
		await playground.rmdir('/tmp/tree', { recursive: true });
		expect(
			await playground.listFiles('/tmp/tree', { prependPath: true })
		).toEqual(['a.php', 'z.php']);
		await playground.request({ url: 'http://example.test/same?q=1#hash' });
		await playground.request({ url: 'relative?q=2#ignored' });
		await playground.request({ url: '?query-only=1#ignored' });
		await playground.request({ url: '#fragment-only' });
		await expect(
			playground.request({ url: 'https://attacker.example/secret' })
		).rejects.toMatchObject({
			code: 'ERR_WP_PLAYGROUND_NATIVE_INVALID_REQUEST',
		});
		await playground.defineConstant('NULL_VALUE', null);
		expect(() => playground.unknownMethod()).toThrow(
			expect.objectContaining({
				code: 'ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED',
			})
		);
		await expect(playground.cli([])).rejects.toMatchObject({
			code: 'ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED',
		});
		const ioFailure = playground.isFile('/wordpress/index.php');
		await expect(ioFailure).rejects.toMatchObject({
			code: 'ERR_WP_PLAYGROUND_NATIVE_IO',
			message: 'filesystem [redacted] unavailable',
		});
		const runResponse = await playground.run({
			scriptPath: '/wordpress/index.php',
			protocol: 'https',
			env: { ENVIRONMENT: 'test' },
			$_SERVER: { HTTP_HOST: 'example.test' },
		});
		expect(runResponse.text).toBe('run output');
		const failedRun = playground.run({ code: '<?php exit(7);' });
		await expect(failedRun).rejects.toBeInstanceOf(
			PHPExecutionFailureError
		);
		await expect(failedRun).rejects.toMatchObject({
			source: 'request',
			response: { exitCode: 7, errors: 'bad stderr' },
		});

		expect(received[0]).toMatchObject({
			protocolVersion: 2,
			method: 'absoluteUrl',
			params: {},
		});
		expect(received.find((rpc) => rpc['method'] === 'rmdir')).toMatchObject(
			{
				params: { path: '/tmp/tree', options: { recursive: true } },
			}
		);
		expect(
			received.find((rpc) => rpc['method'] === 'listFiles')
		).toMatchObject({
			params: { path: '/tmp/tree', options: { prependPath: true } },
		});
		expect(
			received.find((rpc) => rpc['method'] === 'defineConstant')
		).toMatchObject({ params: { name: 'NULL_VALUE', value: null } });
		expect(
			received.find(
				(rpc) =>
					rpc['method'] === 'request' &&
					(rpc['params'] as Record<string, unknown>)['path'] ===
						'/same?q=1'
			)
		).toBeDefined();
		const requestPaths = received
			.filter((rpc) => rpc['method'] === 'request')
			.map((rpc) => (rpc['params'] as Record<string, unknown>)['path']);
		expect(requestPaths).toEqual(
			expect.arrayContaining(['/relative?q=2', '/?query-only=1', '/'])
		);
		expect(received.some((rpc) => rpc['method'] === 'unknownMethod')).toBe(
			false
		);
		client.close();
	});

	it('rejects malformed RPC envelopes with native protocol errors', async () => {
		for (const envelope of [
			null,
			[],
			'not an envelope',
			{ protocolVersion: 2, id: 1 },
			{ protocolVersion: 2, id: 1, result: null, error: null },
			{ protocolVersion: 2, id: 1, error: null },
		]) {
			const { client } = await rawControlServer(
				async (request, response) => {
					if (request.url !== '/rpc') return false;
					await readJson(request);
					response.setHeader('content-type', 'application/json');
					response.end(JSON.stringify(envelope));
					return true;
				}
			);
			await expect(client.call('absoluteUrl')).rejects.toMatchObject({
				name: 'NativeCLIError',
				code: 'ERR_WP_PLAYGROUND_NATIVE_PROTOCOL',
			});
			client.close();
		}
	});

	it('strictly validates buffered response metadata and binary tags', async () => {
		const validRequest = {
			httpStatusCode: 200,
			headers: [],
			body: tagged('body'),
			stderr: tagged(''),
			exitCode: 0,
		};
		const validRun = {
			httpStatusCode: 200,
			headers: [],
			stdout: tagged('stdout'),
			stderr: tagged(''),
			exitCode: 0,
		};
		const cases: Array<{
			method: 'request' | 'run';
			result: Record<string, unknown>;
		}> = [
			{
				method: 'request',
				result: { ...validRequest, httpStatusCode: '200' },
			},
			{ method: 'request', result: { ...validRequest, exitCode: '0' } },
			{ method: 'request', result: { ...validRequest, body: 'body' } },
			{
				method: 'request',
				result: {
					...validRequest,
					body: { ...tagged('body'), extra: true },
				},
			},
			{
				method: 'request',
				result: {
					...validRequest,
					stderr: { encoding: 'base64', data: 'AB==' },
				},
			},
			{
				method: 'run',
				result: { ...validRun, stdout: undefined },
			},
			{ method: 'run', result: { ...validRun, stderr: [] } },
			{ method: 'run', result: { ...validRun, exitCode: 0.5 } },
		];
		for (const testCase of cases) {
			const { client } = await controlServer(async (rpc) =>
				rpc['method'] === testCase.method ? testCase.result : null
			);
			const playground = createPlaygroundProxy(client) as any;
			const operation =
				testCase.method === 'request'
					? playground.request({ url: '/' })
					: playground.run({ code: '<?php echo "ok";' });
			await expect(operation).rejects.toMatchObject({
				name: 'NativeCLIError',
				code: 'ERR_WP_PLAYGROUND_NATIVE_PROTOCOL',
			});
			client.close();
		}
	});

	it('encodes multipart records with upstream-compatible ordering', async () => {
		let requestParams: Record<string, unknown> | undefined;
		const { client } = await controlServer(async (rpc) => {
			if (rpc['method'] === 'request') {
				requestParams = rpc['params'] as Record<string, unknown>;
				return {
					httpStatusCode: 200,
					headers: [],
					body: tagged('ok'),
					stderr: tagged(''),
					exitCode: 0,
				};
			}
			return null;
		});
		const playground = createPlaygroundProxy(client) as any;
		await playground.request({
			url: '/',
			body: { first: 'one', second: new Uint8Array([2, 3]) },
		});
		expect(requestParams).toMatchObject({ method: 'POST' });
		const headers = requestParams?.['headers'] as Array<{
			name: string;
			value: string;
		}>;
		expect(headers[0]?.name).toBe('content-type');
		const body = requestParams?.['body'] as { data: string };
		const decoded = Buffer.from(body.data, 'base64').toString('latin1');
		expect(decoded.indexOf('name="first"')).toBeLessThan(
			decoded.indexOf('name="second"')
		);
		client.close();
	});

	it('streams protocol-v2 frames incrementally', async () => {
		let release!: () => void;
		const released = new Promise<void>((resolve) => (release = resolve));
		const { client } = await rawControlServer(async (request, response) => {
			if (request.url !== '/rpc/stream') return false;
			const rpc = await readJson(request);
			response.writeHead(200, { 'content-type': 'application/x-ndjson' });
			response.write(
				frame(rpc.id, 'headers', {
					httpStatusCode: 200,
					headers: [{ name: 'X-Test', value: 'yes' }],
				})
			);
			response.write(
				frame(rpc.id, 'stdout', { sequence: 0, data: tagged('first') })
			);
			await released;
			response.write(
				frame(rpc.id, 'stderr', { sequence: 1, data: tagged('warn') })
			);
			response.write(
				frame(rpc.id, 'stdout', { sequence: 2, data: tagged('second') })
			);
			response.end(frame(rpc.id, 'complete', { exitCode: 0 }));
			return true;
		});
		const playground = createPlaygroundProxy(client) as any;
		const streamed = await playground.requestStreamed({ url: '/' });
		const reader = streamed.stdout.getReader();
		const first = await reader.read();
		expect(new TextDecoder().decode(first.value)).toBe('first');
		expect(await streamed.headers).toEqual({ 'x-test': ['yes'] });
		release();
		const restPromise = readReader(reader);
		const stderrPromise = streamed.stderrText;
		expect(new TextDecoder().decode(await restPromise)).toBe('second');
		expect(await stderrPromise).toBe('warn');
		expect(await streamed.exitCode).toBe(0);
		expect(await streamed.httpStatusCode).toBe(200);
		client.close();
	});

	it('preserves a sole early error frame and rejects post-terminal frames', async () => {
		const early = await rawControlServer(async (request, response) => {
			if (request.url !== '/rpc/stream') return false;
			const rpc = await readJson(request);
			response.writeHead(200, { 'content-type': 'application/x-ndjson' });
			response.end(
				frame(rpc.id, 'error', {
					error: {
						code: 'ERR_WP_PLAYGROUND_NATIVE_BUSY',
						message: 'worker unavailable',
					},
				})
			);
			return true;
		});
		const earlyResponse = await (
			createPlaygroundProxy(early.client) as any
		).requestStreamed({ url: '/' });
		await expect(earlyResponse.exitCode).rejects.toMatchObject({
			name: 'NativeCLIError',
			code: 'ERR_WP_PLAYGROUND_NATIVE_BUSY',
			message: 'worker unavailable',
		});
		early.client.close();

		const postTerminal = await rawControlServer(
			async (request, response) => {
				if (request.url !== '/rpc/stream') return false;
				const rpc = await readJson(request);
				response.writeHead(200, {
					'content-type': 'application/x-ndjson',
				});
				response.end(
					frame(rpc.id, 'error', {
						error: {
							code: 'ERR_WP_PLAYGROUND_NATIVE_BUSY',
							message: 'worker unavailable',
						},
					}) +
						frame(rpc.id, 'headers', {
							httpStatusCode: 200,
							headers: [],
						})
				);
				return true;
			}
		);
		const invalidResponse = await (
			createPlaygroundProxy(postTerminal.client) as any
		).requestStreamed({ url: '/' });
		await expect(invalidResponse.exitCode).rejects.toMatchObject({
			name: 'NativeCLIError',
			code: 'ERR_WP_PLAYGROUND_NATIVE_PROTOCOL',
			message: expect.stringContaining('after termination'),
		});
		postTerminal.client.close();
	});

	it('cancels the native request when either returned stream is cancelled', async () => {
		for (const output of ['stdout', 'stderr'] as const) {
			const cancelled = vi.fn();
			const { client } = await rawControlServer(
				async (request, response) => {
					const rpc = await readJson(request);
					if (request.url === '/rpc/cancel') {
						cancelled(rpc.id);
						response.setHeader('content-type', 'application/json');
						response.end(
							JSON.stringify({
								protocolVersion: 2,
								id: rpc.id,
								result: { cancelled: true },
							})
						);
						return true;
					}
					if (request.url !== '/rpc/stream') return false;
					response.writeHead(200, {
						'content-type': 'application/x-ndjson',
					});
					response.write(
						frame(rpc.id, 'headers', {
							httpStatusCode: 200,
							headers: [],
						})
					);
					return true;
				}
			);
			const streamed = await (
				createPlaygroundProxy(client) as any
			).requestStreamed({ url: '/' });
			const exitCode = streamed.exitCode.catch(() => undefined);
			await streamed[output].cancel('consumer stopped');
			await vi.waitFor(() => expect(cancelled).toHaveBeenCalledOnce());
			await exitCode;
			client.close();
		}
	});

	it('cancels every active stream when the client closes, idempotently', async () => {
		const cancelled = vi.fn();
		const { client } = await rawControlServer(async (request, response) => {
			const rpc = await readJson(request);
			if (request.url === '/rpc/cancel') {
				cancelled(rpc.id);
				response.setHeader('content-type', 'application/json');
				response.end(
					JSON.stringify({
						protocolVersion: 2,
						id: rpc.id,
						result: { cancelled: true },
					})
				);
				return true;
			}
			if (request.url !== '/rpc/stream') return false;
			response.writeHead(200, { 'content-type': 'application/x-ndjson' });
			response.write(
				frame(rpc.id, 'headers', { httpStatusCode: 200, headers: [] })
			);
			return true;
		});
		const streamed = await (
			createPlaygroundProxy(client) as any
		).requestStreamed({ url: '/' });
		const exitCode = streamed.exitCode.catch(() => undefined);
		client.close();
		client.close();
		await vi.waitFor(() => expect(cancelled).toHaveBeenCalledOnce());
		await exitCode;
	});

	it('spools overflow without blocking exit or an ignored channel', async () => {
		const before = await spoolDirectories();
		const { client } = await rawControlServer(async (request, response) => {
			if (request.url !== '/rpc/stream') return false;
			const rpc = await readJson(request);
			response.writeHead(200, { 'content-type': 'application/x-ndjson' });
			response.write(
				frame(rpc.id, 'headers', { httpStatusCode: 200, headers: [] })
			);
			let sequence = 0;
			for (let index = 0; index < 12; index++) {
				response.write(
					frame(rpc.id, 'stderr', {
						sequence: sequence++,
						data: tagged(`E${index};`),
					})
				);
				if (index % 4 === 0)
					response.write(
						frame(rpc.id, 'stdout', {
							sequence: sequence++,
							data: tagged(`O${index};`),
						})
					);
			}
			response.end(frame(rpc.id, 'complete', { exitCode: 0 }));
			return true;
		});
		const streamed = await (
			createPlaygroundProxy(client) as any
		).requestStreamed({ url: '/' });
		expect(await streamed.exitCode).toBe(0);
		await streamed.finished;
		expect(await streamed.stdoutText).toBe('O0;O4;O8;');
		const during = await spoolDirectories();
		const created = during.filter((path) => !before.includes(path));
		expect(created).toHaveLength(1);
		if (process.platform !== 'win32') {
			expect((await stat(created[0]!)).mode & 0o777).toBe(0o700);
			expect((await stat(`${created[0]!}/stderr.bin`)).mode & 0o777).toBe(
				0o600
			);
		}
		expect(await streamed.stderrText).toBe(
			Array.from({ length: 12 }, (_, index) => `E${index};`).join('')
		);
		await vi.waitFor(async () =>
			expect(await spoolDirectories()).toEqual(before)
		);
		client.close();
	});

	it('removes an overflow spool when the response is cancelled', async () => {
		const before = await spoolDirectories();
		const { client } = await rawControlServer(async (request, response) => {
			const rpc = await readJson(request);
			if (request.url === '/rpc/cancel') {
				response.setHeader('content-type', 'application/json');
				response.end(
					JSON.stringify({
						protocolVersion: 2,
						id: rpc.id,
						result: { cancelled: true },
					})
				);
				return true;
			}
			if (request.url !== '/rpc/stream') return false;
			response.writeHead(200, { 'content-type': 'application/x-ndjson' });
			response.write(
				frame(rpc.id, 'headers', { httpStatusCode: 200, headers: [] })
			);
			for (let sequence = 0; sequence < 9; sequence++)
				response.write(
					frame(rpc.id, 'stderr', {
						sequence,
						data: tagged(`overflow-${sequence}`),
					})
				);
			return true;
		});
		const streamed = await (
			createPlaygroundProxy(client) as any
		).requestStreamed({ url: '/' });
		const exitCode = streamed.exitCode.catch(() => undefined);
		await vi.waitFor(async () =>
			expect((await spoolDirectories()).length).toBeGreaterThan(
				before.length
			)
		);
		await streamed.stdout.cancel();
		await exitCode;
		await vi.waitFor(async () =>
			expect(await spoolDirectories()).toEqual(before)
		);
		client.close();
	});

	it('removes an overflow spool when the stream protocol fails', async () => {
		const before = await spoolDirectories();
		const { client } = await rawControlServer(async (request, response) => {
			if (request.url !== '/rpc/stream') return false;
			const rpc = await readJson(request);
			response.writeHead(200, { 'content-type': 'application/x-ndjson' });
			response.write(
				frame(rpc.id, 'headers', { httpStatusCode: 200, headers: [] })
			);
			for (let sequence = 0; sequence < 9; sequence++)
				response.write(
					frame(rpc.id, 'stderr', {
						sequence,
						data: tagged(`overflow-${sequence}`),
					})
				);
			response.end(
				frame(rpc.id, 'stdout', {
					sequence: 10,
					data: tagged('out of order'),
				})
			);
			return true;
		});
		const streamed = await (
			createPlaygroundProxy(client) as any
		).requestStreamed({ url: '/' });
		await expect(streamed.exitCode).rejects.toMatchObject({
			code: 'ERR_WP_PLAYGROUND_NATIVE_PROTOCOL',
		});
		await vi.waitFor(async () =>
			expect(await spoolDirectories()).toEqual(before)
		);
		client.close();
	});

	it('cleans a completed spool after one channel is cancelled and its sibling is consumed', async () => {
		const before = await spoolDirectories();
		const { client } = await rawControlServer(async (request, response) => {
			if (request.url !== '/rpc/stream') return false;
			const rpc = await readJson(request);
			response.writeHead(200, { 'content-type': 'application/x-ndjson' });
			response.write(
				frame(rpc.id, 'headers', { httpStatusCode: 200, headers: [] })
			);
			for (let sequence = 0; sequence < 9; sequence++)
				response.write(
					frame(rpc.id, 'stdout', {
						sequence,
						data: tagged(`overflow-${sequence}`),
					})
				);
			response.write(
				frame(rpc.id, 'stderr', {
					sequence: 9,
					data: tagged('sibling'),
				})
			);
			response.end(frame(rpc.id, 'complete', { exitCode: 0 }));
			return true;
		});
		const streamed = await (
			createPlaygroundProxy(client) as any
		).requestStreamed({ url: '/' });
		expect(await streamed.exitCode).toBe(0);
		await new Promise((resolve) => setTimeout(resolve, 0));
		await vi.waitFor(async () =>
			expect((await spoolDirectories()).length).toBeGreaterThan(
				before.length
			)
		);
		await streamed.stdout.cancel();
		expect(await streamed.stderrText).toBe('sibling');
		await vi.waitFor(async () =>
			expect(await spoolDirectories()).toEqual(before)
		);
		client.close();
	});

	it('rejects duplicate, out-of-order, and wrong-version frames', async () => {
		for (const frames of [
			[
				{ type: 'headers', httpStatusCode: 200, headers: [] },
				{ type: 'stdout', sequence: 1, data: tagged('bad') },
			],
			[
				{ type: 'headers', httpStatusCode: 200, headers: [] },
				{ type: 'headers', httpStatusCode: 200, headers: [] },
			],
		] as const) {
			const { client } = await rawControlServer(
				async (request, response) => {
					if (request.url !== '/rpc/stream') return false;
					const rpc = await readJson(request);
					response.writeHead(200, {
						'content-type': 'application/x-ndjson',
					});
					for (const value of frames)
						response.write(frame(rpc.id, value.type, value));
					response.end();
					return true;
				}
			);
			const streamed = await (
				createPlaygroundProxy(client) as any
			).requestStreamed({ url: '/' });
			await expect(streamed.exitCode).rejects.toMatchObject({
				code: 'ERR_WP_PLAYGROUND_NATIVE_PROTOCOL',
			});
			client.close();
		}
		const { client } = await rawControlServer(async (request, response) => {
			if (request.url !== '/rpc/stream') return false;
			const rpc = await readJson(request);
			response.writeHead(200, { 'content-type': 'application/x-ndjson' });
			response.end(
				`${JSON.stringify({
					protocolVersion: 1,
					id: rpc.id,
					type: 'headers',
					httpStatusCode: 200,
					headers: [],
				})}\n`
			);
			return true;
		});
		const streamed = await (
			createPlaygroundProxy(client) as any
		).requestStreamed({ url: '/' });
		await expect(streamed.exitCode).rejects.toMatchObject({
			code: 'ERR_WP_PLAYGROUND_NATIVE_PROTOCOL',
		});
		client.close();

		const oversizedServer = await rawControlServer(
			async (request, response) => {
				if (request.url !== '/rpc/stream') return false;
				await readJson(request);
				response.writeHead(200, {
					'content-type': 'application/x-ndjson',
				});
				response.end(`${'x'.repeat(100 * 1024)}\n`);
				return true;
			}
		);
		const oversized = await (
			createPlaygroundProxy(oversizedServer.client) as any
		).requestStreamed({ url: '/' });
		await expect(oversized.exitCode).rejects.toMatchObject({
			code: 'ERR_WP_PLAYGROUND_NATIVE_PROTOCOL',
			message: expect.stringContaining('oversized NDJSON line'),
		});
		oversizedServer.client.close();
	});

	it('delivers all supported events and removes listeners', async () => {
		const { client } = await rawControlServer(async (request, response) => {
			if (request.url !== '/events') return false;
			response.writeHead(200, { 'content-type': 'text/event-stream' });
			response.end(
				': keepalive\n\n' +
					[
						'request.end',
						'request.error',
						'filesystem.write',
						'ready',
						'shutdown',
					]
						.map((type) =>
							type === 'request.error'
								? `event: ${type}\ndata: {"protocolVersion":2,"source":"request","error":{"code":"ERR_WP_PLAYGROUND_NATIVE_RUNTIME","message":"boom"}}\n\n`
								: `event: ${type}\ndata: {"protocolVersion":2}\n\n`
						)
						.join('')
			);
			return true;
		});
		const playground = createPlaygroundProxy(client) as any;
		const types = [
			'request.end',
			'request.error',
			'filesystem.write',
			'ready',
			'shutdown',
		];
		const received: string[] = [];
		let requestError: { error: Error; source?: string } | undefined;
		await Promise.all(
			types.map(
				(type) =>
					new Promise<void>((resolve) =>
						playground.addEventListener(type, (event: any) => {
							received.push(event.type);
							if (event.type === 'request.error')
								requestError = event;
							resolve();
						})
					)
			)
		);
		expect(received.sort()).toEqual([...types].sort());
		expect(requestError?.error).toBeInstanceOf(Error);
		expect(requestError).toMatchObject({
			error: { message: 'boom' },
			source: 'request',
		});
		expect(() => playground.onMessage(() => undefined)).toThrow(
			/onMessage/
		);
		expect(() =>
			playground.addEventListener('message', () => undefined)
		).toThrow(/message/);
		client.close();
	});

	it('decodes Unicode split across event-stream chunks', async () => {
		const { client } = await rawControlServer(async (request, response) => {
			if (request.url !== '/events') return false;
			response.writeHead(200, { 'content-type': 'text/event-stream' });
			const payload = Buffer.from(
				'event: ready\ndata: {"protocolVersion":2,"label":"😀"}\n\n' +
					'event: shutdown\ndata: {"protocolVersion":2}\n\n'
			);
			const emojiOffset = payload.indexOf(Buffer.from('😀'));
			response.write(payload.subarray(0, emojiOffset + 2));
			setTimeout(
				() => response.end(payload.subarray(emojiOffset + 2)),
				5
			);
			return true;
		});
		const playground = createPlaygroundProxy(client) as any;
		const event = await new Promise<MessageEvent<{ label: string }>>(
			(resolve) => playground.addEventListener('ready', resolve)
		);
		expect(event.data.label).toBe('😀');
		client.close();
	});

	it('rejects an oversized terminated SSE message before dispatch', async () => {
		let connections = 0;
		const { client } = await rawControlServer(async (request, response) => {
			if (request.url !== '/events') return false;
			connections++;
			response.writeHead(200, { 'content-type': 'text/event-stream' });
			response.end(
				connections === 1
					? `event: ready\ndata: {"protocolVersion":2,"padding":"${'x'.repeat(100 * 1024)}"}\n\n`
					: 'event: shutdown\ndata: {"protocolVersion":2}\n\n'
			);
			return true;
		});
		const playground = createPlaygroundProxy(client) as any;
		const ready = vi.fn();
		playground.addEventListener('ready', ready);
		const requestError = new Promise<{ error: Error }>((resolve) =>
			playground.addEventListener('request.error', resolve)
		);
		const shutdown = new Promise<void>((resolve) =>
			playground.addEventListener('shutdown', () => resolve())
		);
		await expect(requestError).resolves.toMatchObject({
			error: { message: expect.stringContaining('oversized') },
		});
		await shutdown;
		expect(ready).not.toHaveBeenCalled();
		expect(connections).toBe(2);
		client.close();
	});

	it('reconnects after ordinary event-stream EOF while listeners remain', async () => {
		let connections = 0;
		const { client } = await rawControlServer(async (request, response) => {
			if (request.url !== '/events') return false;
			connections++;
			response.writeHead(200, { 'content-type': 'text/event-stream' });
			response.end(
				connections === 1
					? 'event: ready\ndata: {"protocolVersion":2}\n\n'
					: 'event: shutdown\ndata: {"protocolVersion":2}\n\n'
			);
			return true;
		});
		const playground = createPlaygroundProxy(client) as any;
		await new Promise<void>((resolve) =>
			playground.addEventListener('shutdown', () => resolve())
		);
		expect(connections).toBe(2);
		await new Promise((resolve) => setTimeout(resolve, 75));
		expect(connections).toBe(2);
		client.close();
	});

	it('isolates event listener exceptions from sibling listeners', async () => {
		const { client } = await rawControlServer(async (request, response) => {
			if (request.url !== '/events') return false;
			response.writeHead(200, { 'content-type': 'text/event-stream' });
			response.end(
				'event: ready\ndata: {"protocolVersion":2}\n\n' +
					'event: shutdown\ndata: {"protocolVersion":2}\n\n'
			);
			return true;
		});
		const playground = createPlaygroundProxy(client) as any;
		playground.addEventListener('ready', () => {
			throw new Error('listener failed');
		});
		const sibling = vi.fn();
		await new Promise<void>((resolve) =>
			playground.addEventListener('ready', (event: unknown) => {
				sibling(event);
				resolve();
			})
		);
		expect(sibling).toHaveBeenCalledOnce();
		client.close();
	});

	it('removes listeners for every supported event type', async () => {
		const types = [
			'request.end',
			'request.error',
			'filesystem.write',
			'ready',
			'shutdown',
		];
		const { client } = await rawControlServer(async (request, response) => {
			if (request.url !== '/events') return false;
			response.writeHead(200, { 'content-type': 'text/event-stream' });
			setTimeout(
				() =>
					response.end(
						types
							.map(
								(type) =>
									`event: ${type}\ndata: {"protocolVersion":2}\n\n`
							)
							.join('')
					),
				25
			);
			return true;
		});
		const playground = createPlaygroundProxy(client) as any;
		const removed = types.map(() => vi.fn());
		for (let index = 0; index < types.length; index++) {
			playground.addEventListener(types[index], removed[index]);
			playground.removeEventListener(types[index], removed[index]);
		}
		await new Promise<void>((resolve) =>
			playground.addEventListener('ready', () => resolve())
		);
		await new Promise((resolve) => setTimeout(resolve, 10));
		for (const listener of removed) expect(listener).not.toHaveBeenCalled();
		client.close();
	});
});

async function controlServer(
	handler: (rpc: Record<string, unknown>) => Promise<unknown>
): Promise<{ client: NativeControlClient }> {
	return rawControlServer(async (request, response) => {
		if (request.url !== '/rpc') return false;
		expect(request.headers.authorization).toBe('Bearer secret');
		const rpc = await readJson(request);
		const result = await handler(rpc);
		response.setHeader('content-type', 'application/json');
		response.end(
			JSON.stringify(
				result && typeof result === 'object' && 'error' in result
					? { protocolVersion: 2, id: rpc.id, ...result }
					: { protocolVersion: 2, id: rpc.id, result }
			)
		);
		return true;
	});
}

async function rawControlServer(
	handler: (
		request: import('node:http').IncomingMessage,
		response: import('node:http').ServerResponse
	) => Promise<boolean>
): Promise<{ client: NativeControlClient }> {
	const server = createServer(async (request, response) => {
		try {
			if (!(await handler(request, response))) {
				response.statusCode = 404;
				response.end();
			}
		} catch (error) {
			response.destroy(error as Error);
		}
	});
	await new Promise<void>((resolve) =>
		server.listen(0, '127.0.0.1', resolve)
	);
	openServers.push(server);
	const address = server.address();
	if (!address || typeof address === 'string')
		throw new Error('missing address');
	return {
		client: new NativeControlClient(
			`http://127.0.0.1:${address.port}/rpc`,
			'secret'
		),
	};
}

async function readJson(
	request: import('node:http').IncomingMessage
): Promise<Record<string, any>> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(chunk as Buffer);
	return JSON.parse(Buffer.concat(chunks).toString()) as Record<string, any>;
}

function tagged(value: string): { encoding: 'base64'; data: string } {
	return { encoding: 'base64', data: b64(value) };
}

function b64(value: string): string {
	return Buffer.from(value).toString('base64');
}

function frame(
	id: number,
	type: string,
	fields: Record<string, unknown>
): string {
	const { type: _ignored, ...rest } = fields;
	return `${JSON.stringify({ protocolVersion: 2, id, type, ...rest })}\n`;
}

async function readReader(
	reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [];
	let length = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		length += value.length;
	}
	const output = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.length;
	}
	return output;
}

async function spoolDirectories(): Promise<string[]> {
	return (await readdir(tmpdir()))
		.filter((name) => name.startsWith('wp-playground-native-stream-'))
		.map((name) => join(tmpdir(), name))
		.sort();
}
