import { EventEmitter } from 'node:events';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	ensureNativeHost: vi.fn(),
	parseNativeCLIArgs: vi.fn(),
	spawn: vi.fn(),
	writeHandshake: true,
	nativeServerUrl: 'http://127.0.0.1:65534',
	handshakeOverrides: {} as Record<string, unknown>,
}));

vi.mock('../src/host.js', () => ({
	ensureNativeHost: mocks.ensureNativeHost,
}));

vi.mock('../src/process.js', async () => {
	const actual =
		await vi.importActual<typeof import('../src/process.js')>(
			'../src/process.js'
		);
	return { ...actual, parseNativeCLIArgs: mocks.parseNativeCLIArgs };
});

vi.mock('node:child_process', async () => {
	const actual =
		await vi.importActual<typeof import('node:child_process')>(
			'node:child_process'
		);
	return { ...actual, spawn: mocks.spawn };
});

import {
	internalsKeyForTesting,
	parseOptionsAndRunCLI,
	runCLI,
	type RunCLIArgs,
	type RunCLIServer,
} from '../src/api.js';

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

class StudioBlueprintBundle {
	readonly reads: string[] = [];
	private readonly blueprintJSON: string;

	constructor(blueprintJSON: string) {
		this.blueprintJSON = blueprintJSON;
	}

	async read(
		path: string
	): Promise<{ stream(): ReadableStream<Uint8Array> }> {
		this.reads.push(path);
		const bytes = new TextEncoder().encode(this.blueprintJSON);
		return {
			stream() {
				return new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(bytes);
						controller.close();
					},
				});
			},
		};
	}
}

function streamedBlueprintBundle(
	chunks: Uint8Array[],
	onCancel?: () => void,
	closeAfterStart = true
): { read(path: string): Promise<{ stream(): ReadableStream<Uint8Array> }> } {
	return {
		async read(_path: string) {
			return {
				stream() {
					return new ReadableStream<Uint8Array>({
						start(controller) {
							for (const chunk of chunks)
								controller.enqueue(chunk);
							if (closeAfterStart) controller.close();
						},
						cancel() {
							onCancel?.();
						},
					});
				},
			};
		},
	};
}

beforeEach(() => {
	mocks.writeHandshake = true;
	mocks.nativeServerUrl = 'http://127.0.0.1:65534';
	mocks.handshakeOverrides = {};
	mocks.parseNativeCLIArgs.mockReset().mockResolvedValue({
		status: 'valid',
		command: 'server',
		port: 0,
		siteUrl: null,
	});
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
							protocolVersion: 2,
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
	it('returns a structured disposable server result from argv', async () => {
		const result = await parseOptionsAndRunCLI([
			'server',
			'--port=0',
			'--wp',
			'latest',
		]);
		if ('exitCode' in result)
			throw new Error(`unexpected CLI exit ${result.exitCode}`);
		const cliServer = result[internalsKeyForTesting].cliServer;
		expect(cliServer.server.listening).toBe(true);
		expect(cliServer.serverUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
		expect(mocks.parseNativeCLIArgs).toHaveBeenCalledWith(
			['server', '--port=0', '--wp', 'latest'],
			{ cwd: process.cwd() }
		);
		const argv = mocks.spawn.mock.calls.at(-1)?.[1] as string[];
		expect(argv).not.toContain('--port=0');
		expect(
			argv.slice(argv.indexOf('--port'), argv.indexOf('--port') + 2)
		).toEqual(['--port', '0']);
		expect(
			argv.slice(
				argv.indexOf('--site-url'),
				argv.indexOf('--site-url') + 2
			)
		).toEqual(['--site-url', cliServer.serverUrl]);
		await result[Symbol.asyncDispose]();
		await result[Symbol.asyncDispose]();
		expect(cliServer.server.listening).toBe(false);
	});

	it('validates supported argument values before acquisition', async () => {
		const circular: Record<string, unknown> = {};
		circular['self'] = circular;
		const customMount = Object.assign(Object.create({ inherited: true }), {
			hostPath: '/host',
			vfsPath: '/wordpress',
		});
		const customDefinitions = Object.assign(
			Object.create({ inherited: true }),
			{
				VALUE: 'value',
			}
		);
		const sparsePositionals = new Array<string>(1);
		class PositionalArray extends Array<string> {}
		class ArgsWithPrototype {
			command = 'start';
		}
		const deepBlueprint: Record<string, unknown> = {};
		let deepCursor = deepBlueprint;
		for (let depth = 0; depth <= 65; depth++) {
			const next: Record<string, unknown> = {};
			deepCursor['next'] = next;
			deepCursor = next;
		}
		const blueprintAccessor = {};
		Object.defineProperty(blueprintAccessor, 'steps', {
			get: () => [],
		});
		const mountAccessor = [{ hostPath: '/host', vfsPath: '/wordpress' }];
		Object.defineProperty(mountAccessor, '0', {
			get: () => ({ hostPath: '/host', vfsPath: '/wordpress' }),
		});
		const argsAccessor = {};
		Object.defineProperty(argsAccessor, 'command', { get: () => 'start' });
		const argsSymbol = { command: 'start' };
		Object.defineProperty(argsSymbol, Symbol('extra'), { value: true });
		const invalidArguments: unknown[] = [
			null,
			[],
			Object.create(null),
			new ArgsWithPrototype(),
			argsAccessor,
			argsSymbol,
			{ command: 'unknown' },
			{ command: 'start', debug: 'yes' },
			{ command: 'start', _: sparsePositionals },
			{ command: 'start', _: new PositionalArray('start') },
			{ command: 'start', path: 42 },
			{ command: 'start', php: '8.3' },
			{ command: 'start', verbosity: 'verbose' },
			{ command: 'start', wordpressInstallMode: 'sometimes' },
			{ command: 'start', port: -1 },
			{ command: 'start', port: 65_536 },
			{ command: 'start', port: 1.5 },
			{ command: 'start', workers: 0 },
			{ command: 'start', workers: Number.POSITIVE_INFINITY },
			{ command: 'start', workers: 2 },
			{ command: 'server', workers: 257 },
			{ command: 'start', debug: true },
			{ command: 'run-blueprint', port: 1234 },
			{ command: 'start', startupTimeoutMs: 0 },
			{ command: 'start', startupTimeoutMs: 2_147_483_648 },
			{ command: 'start', autoMount: 1 },
			{ command: 'start', blueprint: [] },
			{ command: 'start', blueprint: new Date() },
			{ command: 'start', blueprint: circular },
			{ command: 'start', blueprint: { steps: [undefined] } },
			{ command: 'start', blueprint: { value: BigInt(1) } },
			{ command: 'start', blueprint: { value: Number.NaN } },
			{ command: 'start', blueprint: deepBlueprint },
			{ command: 'start', blueprint: blueprintAccessor },
			{
				command: 'start',
				blueprint: { value: 'x'.repeat(16 * 1024 * 1024) },
			},
			{ command: 'start', mount: {} },
			{ command: 'start', mount: [[]] },
			{ command: 'start', mount: mountAccessor },
			{ command: 'start', mount: [customMount] },
			{
				command: 'start',
				mount: [
					{ hostPath: '/host', vfsPath: '/wordpress', extra: true },
				],
			},
			{
				command: 'start',
				mount: [{ hostPath: '/host', vfsPath: 1 }],
			},
			{ command: 'start', define: [] },
			{ command: 'start', define: { VALUE: 1 } },
			{ command: 'start', define: customDefinitions },
			{ command: 'start', 'define-bool': { VALUE: 'true' } },
			{ command: 'start', 'define-number': { VALUE: Number.NaN } },
			{
				command: 'start',
				define: { VALUE: 'one' },
				'define-number': { VALUE: 1 },
			},
			{ command: 'start\0' },
			{ command: 'start', path: '/host\0path' },
			{ command: 'start', blueprint: { value: 'bad\0value' } },
			{
				command: 'start',
				mount: [{ hostPath: '/host\0path', vfsPath: '/wordpress' }],
			},
			{ command: 'start', define: { 'BAD\0NAME': 'value' } },
			{ command: 'start', define: { NAME: 'bad\0value' } },
		];
		for (const args of invalidArguments)
			await expect(runCLI(args as RunCLIArgs)).rejects.toMatchObject({
				name: 'NativeCLIError',
				code: 'ERR_WP_PLAYGROUND_NATIVE_INVALID_REQUEST',
			});
		expect(mocks.ensureNativeHost).not.toHaveBeenCalled();
		expect(mocks.spawn).not.toHaveBeenCalled();
	});

	it('allows known undefined option spreads but still rejects unknown ones', async () => {
		const result = (await runCLI({
			command: 'start',
			workers: undefined,
			experimentalTrace: undefined,
		})) as RunCLIServer;
		await result[Symbol.asyncDispose]();
		await expect(
			runCLI({ command: 'start', unknownOption: undefined } as RunCLIArgs)
		).rejects.toMatchObject({
			code: 'ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED',
		});
	});

	it('accepts and translates the exact-layout Studio startup shape', async () => {
		const constants = {
			DB_NAME: 'wordpress',
			WP_DEBUG: false,
			WP_DEBUG_LOG: true,
			WP_DEBUG_DISPLAY: false,
		};
		const bundle = new StudioBlueprintBundle(
			JSON.stringify({
				constants,
				preferredVersions: { php: '8.2', wp: '6.8' },
				steps: [
					{
						step: 'setSiteOptions',
						options: { blogname: 'Studio' },
					},
				],
			})
		);
		const result = (await runCLI({
			command: 'server',
			internalCookieStore: false,
			login: false,
			followSymlinks: true,
			skipSqliteSetup: false,
			port: 0,
			'mount-before-install': [
				{
					hostPath: '/studio/site',
					vfsPath: '/wordpress',
				},
			],
			'site-url': 'http://localhost:8881',
			blueprint: bundle,
			wordpressInstallMode: 'install-from-existing-files-if-needed',
			redis: false,
			memcached: false,
		})) as RunCLIServer;

		expect(bundle.reads).toEqual(['/blueprint.json']);
		const argv = mocks.spawn.mock.calls.at(-1)?.[1] as string[];
		expect(
			argv.slice(argv.indexOf('--php'), argv.indexOf('--php') + 2)
		).toEqual(['--php', '8.2']);
		expect(
			argv.slice(argv.indexOf('--wp'), argv.indexOf('--wp') + 2)
		).toEqual(['--wp', '6.8']);
		expect(argv).not.toContain('--internal-cookie-store');
		expect(argv).not.toContain('--redis');
		expect(argv).not.toContain('--memcached');
		const blueprintPath = argv[argv.indexOf('--blueprint') + 1];
		if (!blueprintPath) throw new Error('missing Studio Blueprint path');
		expect(JSON.parse(await readFile(blueprintPath, 'utf8'))).toEqual({
			steps: [
				{ step: 'defineWpConfigConsts', consts: constants },
				{
					step: 'setSiteOptions',
					options: { blogname: 'Studio' },
				},
			],
		});
		await result[Symbol.asyncDispose]();
	});

	it('rejects enabled Studio-only integrations before acquisition', async () => {
		for (const name of [
			'internalCookieStore',
			'redis',
			'memcached',
		] as const)
			await expect(
				runCLI({ command: 'server', [name]: true })
			).rejects.toMatchObject({
				name: 'NativeCLIError',
				code: 'ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED',
			});
		expect(mocks.ensureNativeHost).not.toHaveBeenCalled();
		expect(mocks.spawn).not.toHaveBeenCalled();
	});

	it('cancels Studio Blueprint streams that exceed the JSON limit', async () => {
		const onCancel = vi.fn();
		const blueprint = streamedBlueprintBundle(
			[new Uint8Array(16 * 1024 * 1024 + 1)],
			onCancel,
			false
		);
		await expect(
			runCLI({ command: 'server', blueprint })
		).rejects.toMatchObject({
			name: 'NativeCLIError',
			code: 'ERR_WP_PLAYGROUND_NATIVE_INVALID_REQUEST',
			message: expect.stringContaining('must not exceed'),
		});
		expect(onCancel).toHaveBeenCalledOnce();
		expect(mocks.ensureNativeHost).not.toHaveBeenCalled();
		expect(mocks.spawn).not.toHaveBeenCalled();
	});

	it('rejects invalid UTF-8 in Studio Blueprint streams', async () => {
		const blueprint = streamedBlueprintBundle([
			new Uint8Array([0xc3, 0x28]),
		]);
		await expect(
			runCLI({ command: 'server', blueprint })
		).rejects.toMatchObject({
			name: 'NativeCLIError',
			code: 'ERR_WP_PLAYGROUND_NATIVE_INVALID_REQUEST',
			message: expect.stringContaining('valid UTF-8'),
		});
		expect(mocks.ensureNativeHost).not.toHaveBeenCalled();
		expect(mocks.spawn).not.toHaveBeenCalled();
	});

	it('rejects unsafe or unsupported Studio Blueprint metadata before acquisition', async () => {
		const readAccessor = {};
		Object.defineProperty(readAccessor, 'read', {
			get: () => async () => undefined,
		});
		const streamedFileAccessor = {};
		Object.defineProperty(streamedFileAccessor, 'stream', {
			get: () => () => undefined,
		});
		const streamAccessor = {
			async read() {
				return streamedFileAccessor;
			},
		};
		const proxiedBundle = new Proxy(
			{
				async read() {
					return undefined;
				},
			},
			{}
		);
		for (const blueprint of [
			new StudioBlueprintBundle(
				JSON.stringify({
					preferredVersions: { php: '8.3', wp: 'latest' },
				})
			),
			new StudioBlueprintBundle(
				JSON.stringify({
					constants: [],
					preferredVersions: { php: '8.2', wp: 'latest' },
				})
			),
			readAccessor,
			streamAccessor,
			proxiedBundle,
		])
			await expect(
				runCLI({ command: 'server', blueprint })
			).rejects.toMatchObject({
				name: 'NativeCLIError',
				code: 'ERR_WP_PLAYGROUND_NATIVE_INVALID_REQUEST',
			});
		expect(mocks.ensureNativeHost).not.toHaveBeenCalled();
		expect(mocks.spawn).not.toHaveBeenCalled();
	});

	it('captures the Studio bundle capability before caller mutation', async () => {
		const bundle = new StudioBlueprintBundle(
			JSON.stringify({
				preferredVersions: { php: '8.2', wp: '6.8' },
				constants: { SNAPSHOT_VALUE: 'before' },
			})
		);
		const args: RunCLIArgs = {
			command: 'server',
			blueprint: bundle,
		};
		const mutatedRead = vi.fn(async () => {
			throw new Error('mutated read must not run');
		});
		const running = runCLI(args) as Promise<RunCLIServer>;
		args.blueprint = { steps: [{ step: 'mutated' }] };
		Object.defineProperty(bundle, 'read', { value: mutatedRead });

		const result = await running;
		expect(bundle.reads).toEqual(['/blueprint.json']);
		expect(mutatedRead).not.toHaveBeenCalled();
		const argv = mocks.spawn.mock.calls.at(-1)?.[1] as string[];
		const blueprintPath = argv[argv.indexOf('--blueprint') + 1];
		if (!blueprintPath) throw new Error('missing Studio Blueprint path');
		expect(JSON.parse(await readFile(blueprintPath, 'utf8'))).toEqual({
			steps: [
				{
					step: 'defineWpConfigConsts',
					consts: { SNAPSHOT_VALUE: 'before' },
				},
			],
		});
		await result[Symbol.asyncDispose]();
	});

	it('snapshots nested arguments before the first await', async () => {
		const blueprint = { steps: [] as Array<Record<string, unknown>> };
		const mount = { hostPath: '/host', vfsPath: '/wordpress' };
		const definitions = { SNAPSHOT_VALUE: 'before' };
		const args: RunCLIArgs = {
			command: 'start',
			port: 0,
			blueprint,
			mount: [mount],
			define: definitions,
		};
		const running = runCLI(args) as Promise<RunCLIServer>;
		args.command = 'php';
		blueprint.steps.push({ step: 'mutated' });
		mount.hostPath = '/mutated';
		definitions.SNAPSHOT_VALUE = 'after';
		args.mount?.push({ hostPath: '/extra', vfsPath: '/extra' });

		const result = await running;
		const argv = mocks.spawn.mock.calls.at(-1)?.[1] as string[];
		expect(argv[0]).toBe('start');
		expect(argv).toContain('/host');
		expect(argv).not.toContain('/mutated');
		expect(argv).not.toContain('/extra');
		expect(argv).toContain('before');
		expect(argv).not.toContain('after');
		const blueprintPath = argv[argv.indexOf('--blueprint') + 1];
		if (!blueprintPath) throw new Error('missing Blueprint snapshot path');
		expect(JSON.parse(await readFile(blueprintPath, 'utf8'))).toEqual({
			steps: [],
		});
		await result[Symbol.asyncDispose]();
	});

	it('keeps unsupported keys and commands in the Unsupported category', async () => {
		for (const args of [
			{ command: 'php' },
			{ command: 'start', experimentalTrace: false },
			{ command: 'start', unknownOption: false },
			{ command: 'start', unknownOption: undefined },
			{ command: 'start', _: ['start', 'extra'] },
		])
			await expect(runCLI(args as RunCLIArgs)).rejects.toMatchObject({
				name: 'NativeCLIError',
				code: 'ERR_WP_PLAYGROUND_NATIVE_UNSUPPORTED',
			});
		expect(mocks.ensureNativeHost).not.toHaveBeenCalled();
		expect(mocks.spawn).not.toHaveBeenCalled();
	});

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
