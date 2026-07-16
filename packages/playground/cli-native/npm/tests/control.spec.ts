import { createServer } from 'node:http';
import { rm, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	createPlaygroundProxy,
	createControlCredentials,
	NativeControlClient,
	NativePHPResponse,
	PHPExecutionFailureError,
} from '../src/control.js';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
	for (const callback of cleanup.splice(0)) await callback();
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

	it('uses protocol-v1 objects and reconstructs PHP responses', async () => {
		const received: Array<Record<string, unknown>> = [];
		const server = createServer(async (request, response) => {
			expect(request.url).toBe('/rpc');
			expect(request.headers.authorization).toBe('Bearer secret');
			const chunks: Buffer[] = [];
			for await (const chunk of request) chunks.push(chunk as Buffer);
			const rpc = JSON.parse(Buffer.concat(chunks).toString()) as Record<
				string,
				unknown
			>;
			received.push(rpc);
			const params = rpc['params'] as Record<string, unknown>;
			let result: unknown;
			if (rpc['method'] === 'absoluteUrl') {
				result = 'http://example.test';
			} else if (rpc['method'] === 'run') {
				const failed = params['code'] === '<?php exit(7);';
				result = {
					exitCode: failed ? 7 : 0,
					httpStatusCode: failed ? 500 : 200,
					headers: [],
					stdout: {
						encoding: 'base64',
						data: Buffer.from(
							failed ? 'bad stdout' : 'run output'
						).toString('base64'),
					},
					stderr: {
						encoding: 'base64',
						data: Buffer.from(failed ? 'bad stderr' : '').toString(
							'base64'
						),
					},
				};
			} else if (rpc['method'] === 'writeFile') {
				result = null;
			} else {
				result = {
					httpStatusCode: 200,
					headers: [{ name: 'Content-Type', value: 'text/plain' }],
					body: {
						encoding: 'base64',
						data: Buffer.from('hello').toString('base64'),
					},
				};
			}
			response.setHeader('content-type', 'application/json');
			response.end(
				JSON.stringify({ protocolVersion: 1, id: rpc['id'], result })
			);
		});
		await new Promise<void>((resolvePromise) =>
			server.listen(0, '127.0.0.1', resolvePromise)
		);
		cleanup.push(
			() =>
				new Promise((resolvePromise) =>
					server.close(() => resolvePromise())
				)
		);
		const address = server.address();
		if (!address || typeof address === 'string')
			throw new Error('missing test address');
		const client = new NativeControlClient(
			`http://127.0.0.1:${address.port}/rpc`,
			'secret'
		);
		const playground = createPlaygroundProxy(client) as {
			absoluteUrl: Promise<string>;
			request(
				options: Record<string, unknown>
			): Promise<NativePHPResponse>;
			requestStreamed(
				options: Record<string, unknown>
			): Promise<{ stdoutText: Promise<string> }>;
			writeFile(path: string, data: string): Promise<void>;
			rmdir(path: string, options?: unknown): Promise<void>;
			run(options: Record<string, unknown>): Promise<NativePHPResponse>;
		};

		expect(await playground.absoluteUrl).toBe('http://example.test');
		const phpResponse = await playground.request({
			url: '/',
			method: 'GET',
		});
		expect(phpResponse).toBeInstanceOf(NativePHPResponse);
		expect(phpResponse.text).toBe('hello');
		expect(phpResponse.headers).toEqual({ 'content-type': ['text/plain'] });
		expect(
			await (
				await playground.requestStreamed({ url: '/' })
			).stdoutText
		).toBe('hello');
		await playground.writeFile('/tmp/example', 'hello');
		await expect(
			playground.rmdir('/tmp/example', { recursive: true })
		).rejects.toMatchObject({
			code: 'ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED',
		});
		const runResponse = await playground.run({
			scriptPath: '/wordpress/index.php',
			protocol: 'https',
			env: { ENVIRONMENT: 'test' },
			server: { HTTP_HOST: 'example.test' },
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
			protocolVersion: 1,
			method: 'absoluteUrl',
			params: {},
		});
		expect(received[1]).toMatchObject({
			protocolVersion: 1,
			method: 'request',
			params: { path: '/', method: 'GET', headers: [] },
		});
		expect(received[3]).toMatchObject({
			method: 'writeFile',
			params: {
				path: '/tmp/example',
				data: {
					encoding: 'base64',
					data: Buffer.from('hello').toString('base64'),
				},
			},
		});
		expect(received[4]).toMatchObject({
			method: 'run',
			params: {
				scriptPath: '/wordpress/index.php',
				protocol: 'https',
				env: { ENVIRONMENT: 'test' },
				$_SERVER: { HTTP_HOST: 'example.test' },
			},
		});
		client.close();
	});

	it('ignores SSE heartbeats and rejects unsupported message subscriptions', async () => {
		const server = createServer((request, response) => {
			expect(request.url).toBe('/events');
			response.writeHead(200, { 'content-type': 'text/event-stream' });
			response.end(
				': keepalive\n\n\n\nevent: ready\ndata: {"protocolVersion":1}\n\n'
			);
		});
		await new Promise<void>((resolvePromise) =>
			server.listen(0, '127.0.0.1', resolvePromise)
		);
		cleanup.push(
			() =>
				new Promise((resolvePromise) =>
					server.close(() => resolvePromise())
				)
		);
		const address = server.address();
		if (!address || typeof address === 'string')
			throw new Error('missing test address');
		const client = new NativeControlClient(
			`http://127.0.0.1:${address.port}/rpc`,
			'secret'
		);
		const playground = createPlaygroundProxy(client) as {
			addEventListener(type: string, listener: EventListener): void;
			onMessage(listener: EventListener): void;
		};
		expect(() => playground.onMessage(() => undefined)).toThrow(
			/not expose PHP worker message events/
		);
		expect(() =>
			playground.addEventListener('message', () => undefined)
		).toThrow(/message is not supported/);
		await new Promise<void>((resolvePromise) =>
			playground.addEventListener('ready', () => resolvePromise())
		);
		client.close();
	});
});
