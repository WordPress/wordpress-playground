import { EventEmitter } from 'node:events';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { readdir, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	ensureNativeHost: vi.fn(),
	spawn: vi.fn(),
	writeHandshake: true,
	nativeServerUrl: 'http://127.0.0.1:65534',
	handshakeOverrides: {} as Record<string, unknown>,
}));

vi.mock('../src/host.js', () => ({
	ensureNativeHost: mocks.ensureNativeHost,
}));

vi.mock('node:child_process', async () => {
	const actual =
		await vi.importActual<typeof import('node:child_process')>(
			'node:child_process'
		);
	return { ...actual, spawn: mocks.spawn };
});

import { runCLI, type RunCLIServer } from '../src/api.js';

class FakeChild extends EventEmitter {
	stderr = new PassThrough();
	exitCode: number | null = null;
	signalCode: NodeJS.Signals | null = null;
	pid: number | undefined = 12_345;

	kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
		if (this.signalCode !== null) return false;
		this.signalCode = signal;
		queueMicrotask(() => {
			this.emit('exit', null, signal);
			this.emit('close', null, signal);
		});
		return true;
	}
}

const openServers: Server[] = [];

beforeEach(() => {
	mocks.writeHandshake = true;
	mocks.nativeServerUrl = 'http://127.0.0.1:65534';
	mocks.handshakeOverrides = {};
	mocks.ensureNativeHost.mockReset().mockResolvedValue({
		executablePath: '/fixture/wp-playground-native',
		assetRoot: '/fixture/assets',
	});
	mocks.spawn
		.mockReset()
		.mockImplementation(
			(
				_executable: string,
				argv: string[],
				options: { env: NodeJS.ProcessEnv }
			) => {
				const child = new FakeChild();
				const handshakeIndex = argv.indexOf(
					'--experimental-control-handshake'
				);
				if (mocks.writeHandshake && handshakeIndex !== -1) {
					const handshakePath = argv[handshakeIndex + 1];
					if (!handshakePath)
						throw new Error('missing handshake path');
					const temporaryPath = `${handshakePath}.test-tmp`;
					void writeFile(
						temporaryPath,
						JSON.stringify({
							protocolVersion: 1,
							serverUrl: argv[argv.indexOf('--site-url') + 1],
							nativeServerUrl: mocks.nativeServerUrl,
							controlUrl: 'http://127.0.0.1:65534/rpc',
							workerCount: 2,
							documentRoot: '/wordpress',
							pid: child.pid,
							...mocks.handshakeOverrides,
						})
					).then(() => rename(temporaryPath, handshakePath));
				}
				return child;
			}
		);
});

afterEach(async () => {
	delete process.env['WP_PLAYGROUND_NATIVE_STARTUP_TIMEOUT_MS'];
	await Promise.all(
		openServers.splice(0).map(
			(server) =>
				new Promise<void>((resolvePromise) => {
					if (!server.listening) return resolvePromise();
					server.close(() => resolvePromise());
				})
		)
	);
});

describe.sequential('programmatic native server lifecycle', () => {
	it('uses an ephemeral start port and keeps serverUrl on the Node proxy', async () => {
		const result = (await runCLI({
			command: 'start',
			'site-url': 'https://wordpress.example',
		})) as RunCLIServer;
		const address = result.server.address();
		if (!address || typeof address === 'string')
			throw new Error('missing proxy address');
		expect(address.port).not.toBe(9400);
		expect(result.serverUrl).toBe(`http://127.0.0.1:${address.port}`);
		const argv = mocks.spawn.mock.calls.at(-1)?.[1] as string[];
		expect(
			argv.slice(argv.indexOf('--port'), argv.indexOf('--port') + 2)
		).toEqual(['--port', '0']);
		expect(
			argv.slice(
				argv.indexOf('--site-url'),
				argv.indexOf('--site-url') + 2
			)
		).toEqual(['--site-url', 'https://wordpress.example']);
		await result[Symbol.asyncDispose]();
		await result[Symbol.asyncDispose]();
		expect(result.server.listening).toBe(false);
	});

	it('falls back to an ephemeral port only for an implicit server port', async () => {
		const blocker = createServer();
		try {
			await listen(blocker, 9400);
			openServers.push(blocker);
		} catch (cause) {
			if ((cause as NodeJS.ErrnoException).code !== 'EADDRINUSE')
				throw cause;
		}
		const result = (await runCLI({ command: 'server' })) as RunCLIServer;
		const address = result.server.address();
		if (!address || typeof address === 'string')
			throw new Error('missing proxy address');
		expect(address.port).not.toBe(9400);
		await result[Symbol.asyncDispose]();
	});

	it('does not fall back when an explicit port is occupied', async () => {
		const blocker = createServer();
		await listen(blocker, 0);
		openServers.push(blocker);
		const address = blocker.address();
		if (!address || typeof address === 'string')
			throw new Error('missing blocker address');
		await expect(
			runCLI({ command: 'server', port: address.port })
		).rejects.toMatchObject({ code: 'EADDRINUSE' });
		expect(mocks.ensureNativeHost).not.toHaveBeenCalled();
	});

	it('closes the listener when host acquisition fails', async () => {
		const port = await reservePort();
		mocks.ensureNativeHost.mockRejectedValueOnce(
			new Error('fixture unavailable')
		);
		await expect(runCLI({ command: 'start', port })).rejects.toThrow(
			'fixture unavailable'
		);
		const rebound = createServer();
		await listen(rebound, port);
		openServers.push(rebound);
	});

	it('cleans blueprint temp state when serialization fails', async () => {
		const before = await blueprintTempDirectories();
		const circular: Record<string, unknown> = {};
		circular['self'] = circular;
		await expect(
			runCLI({ command: 'start', port: 0, blueprint: circular })
		).rejects.toThrow(/circular/i);
		expect(await blueprintTempDirectories()).toEqual(before);
	});

	it('uses a configurable handshake timeout and releases the port', async () => {
		const port = await reservePort();
		const before = await blueprintTempDirectories();
		mocks.writeHandshake = false;
		await expect(
			runCLI({
				command: 'start',
				port,
				startupTimeoutMs: 25,
				blueprint: { steps: [] },
			})
		).rejects.toThrow('Timed out after 25ms');
		expect(await blueprintTempDirectories()).toEqual(before);
		const rebound = createServer();
		await listen(rebound, port);
		openServers.push(rebound);
	});

	it('closes the proxy when the native child exits unexpectedly', async () => {
		const result = (await runCLI({
			command: 'start',
			port: 0,
		})) as RunCLIServer;
		const child = mocks.spawn.mock.results.at(-1)?.value as FakeChild;
		child.exitCode = 9;
		child.emit('exit', 9, null);
		await vi.waitFor(() => expect(result.server.listening).toBe(false));
	});

	it('rejects a handshake that does not belong to the spawned child', async () => {
		mocks.handshakeOverrides = { pid: 999 };
		await expect(runCLI({ command: 'start', port: 0 })).rejects.toThrow(
			/does not match child PID/
		);
	});

	it('does not proxy absolute request targets to another origin', async () => {
		let attackerRequests = 0;
		const attacker = createServer((_request, response) => {
			attackerRequests++;
			response.end('attacker');
		});
		await listen(attacker, 0);
		openServers.push(attacker);
		const attackerAddress = attacker.address();
		if (!attackerAddress || typeof attackerAddress === 'string')
			throw new Error('missing attacker address');

		const result = (await runCLI({
			command: 'start',
			port: 0,
		})) as RunCLIServer;
		const proxyAddress = result.server.address();
		if (!proxyAddress || typeof proxyAddress === 'string')
			throw new Error('missing proxy address');
		const status = await new Promise<number>((resolvePromise, reject) => {
			const request = httpRequest(
				{
					host: '127.0.0.1',
					port: proxyAddress.port,
					path: `http://127.0.0.1:${attackerAddress.port}/secret`,
				},
				(response) => {
					response.resume();
					response.once('end', () =>
						resolvePromise(response.statusCode ?? 0)
					);
				}
			);
			request.once('error', reject);
			request.end();
		});
		expect(status).toBe(400);
		expect(attackerRequests).toBe(0);
		await result[Symbol.asyncDispose]();
	});
});

function listen(server: Server, port: number): Promise<void> {
	return new Promise((resolvePromise, reject) => {
		server.once('error', reject);
		server.listen(port, '127.0.0.1', () => {
			server.off('error', reject);
			resolvePromise();
		});
	});
}

async function reservePort(): Promise<number> {
	const server = createServer();
	await listen(server, 0);
	const address = server.address();
	if (!address || typeof address === 'string')
		throw new Error('missing reserved address');
	await new Promise<void>((resolvePromise) =>
		server.close(() => resolvePromise())
	);
	return address.port;
}

async function blueprintTempDirectories(): Promise<string[]> {
	return (await readdir(tmpdir()))
		.filter((name) => name.startsWith('wp-playground-native-blueprint-'))
		.sort();
}
