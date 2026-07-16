import { spawn, type ChildProcess } from 'node:child_process';
import { cpus } from 'node:os';
import {
	createServer,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from 'node:http';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NativeCLIError, NativeCLIErrorCode } from './errors.js';
import { ensureNativeHost } from './host.js';
import {
	createControlCredentials,
	createPlaygroundProxy,
	NativeControlClient,
	waitForControlHandshake,
	type NativePHPResponse,
	type NativeStreamedPHPResponse,
} from './control.js';
import { runNativeCLI } from './process.js';

export const LogVerbosity = {
	Quiet: { name: 'quiet', severity: 5 },
	Normal: { name: 'normal', severity: 2 },
	Debug: { name: 'debug', severity: 0 },
} as const;

export type LogVerbosity =
	(typeof LogVerbosity)[keyof typeof LogVerbosity]['name'];
export type WorkerType = 'v1' | 'v2';

export interface Mount {
	hostPath: string;
	vfsPath: string;
}

export interface RunCLIArgs {
	_?: string[];
	command: 'start' | 'server' | 'run-blueprint' | 'build-snapshot' | 'php';
	blueprint?: unknown;
	debug?: boolean;
	login?: boolean;
	mount?: Mount[];
	'mount-before-install'?: Mount[];
	outfile?: string;
	php?: string;
	port?: number;
	'site-url'?: string;
	quiet?: boolean;
	verbosity?: LogVerbosity;
	wp?: string;
	autoMount?: string | boolean;
	workers?: number | 'auto';
	wordpressInstallMode?: string;
	define?: Record<string, string>;
	'define-bool'?: Record<string, boolean>;
	'define-number'?: Record<string, number>;
	skipSqliteSetup?: boolean;
	followSymlinks?: boolean;
	'blueprint-may-read-adjacent-files'?: boolean;
	path?: string;
	skipBrowser?: boolean;
	reset?: boolean;
	startupTimeoutMs?: number;
	[key: string]: unknown;
}

export interface NativePlaygroundRequest {
	url?: string;
	path?: string;
	method?: string;
	headers?: Record<string, string | string[]>;
	body?: string | Uint8Array;
}

export interface NativePlaygroundRunOptions {
	code?: string;
	scriptPath?: string;
	relativeUri?: string;
	protocol?: string;
	method?: string;
	headers?: Record<string, string | string[]>;
	body?: string | Uint8Array;
	env?: Record<string, string>;
	server?: Record<string, string>;
	$_SERVER?: Record<string, string>;
}

export interface NativePlaygroundWorker {
	readonly absoluteUrl: Promise<string>;
	readonly documentRoot: Promise<string>;
	request(options: NativePlaygroundRequest): Promise<NativePHPResponse>;
	requestStreamed(
		options: NativePlaygroundRequest
	): Promise<NativeStreamedPHPResponse>;
	run(options: NativePlaygroundRunOptions): Promise<NativePHPResponse>;
	mkdir(path: string): Promise<void>;
	mkdirTree(path: string): Promise<void>;
	readFileAsText(path: string): Promise<string>;
	readFileAsBuffer(path: string): Promise<Uint8Array>;
	writeFile(path: string, data: string | Uint8Array): Promise<void>;
	unlink(path: string): Promise<void>;
	mv(fromPath: string, toPath: string): Promise<void>;
	rmdir(path: string): Promise<void>;
	listFiles(path: string): Promise<string[]>;
	isDir(path: string): Promise<boolean>;
	isFile(path: string): Promise<boolean>;
	fileExists(path: string): Promise<boolean>;
	chdir(path: string): Promise<void>;
	cwd(): Promise<string>;
	defineConstant(
		name: string,
		value: string | number | boolean
	): Promise<void>;
	pathToInternalUrl(path: string): Promise<string>;
	internalUrlToPath(url: string): Promise<string>;
	cli(...args: unknown[]): Promise<never>;
	addEventListener(type: string, listener: EventListener): void;
	removeEventListener(type: string, listener: EventListener): void;
	onMessage(listener: EventListener): void;
}

export type PlaygroundCliWorker = NativePlaygroundWorker;
export const internalsKeyForTesting = Symbol('playground-cli-testing');

export interface RunCLIServer extends AsyncDisposable {
	playground: PlaygroundCliWorker;
	server: Server;
	serverUrl: string;
	[Symbol.asyncDispose](): Promise<void>;
	[internalsKeyForTesting]: { workerThreadCount: number };
}

export function resolveWorkerCount(value: number | 'auto' | undefined): number {
	const cpusMinusOne = Math.max(1, cpus().length - 1);
	if (value === undefined) return Math.min(6, cpusMinusOne);
	if (value === 'auto') return cpusMinusOne;
	return value;
}

export function mergeDefinedConstants(args: {
	define?: Record<string, string>;
	'define-bool'?: Record<string, boolean>;
	'define-number'?: Record<string, number>;
}): Record<string, string | number | boolean> {
	const merged: Record<string, string | number | boolean> = {};
	for (const [kind, values] of [
		['string', args.define],
		['bool', args['define-bool']],
		['number', args['define-number']],
	] as const) {
		for (const [name, value] of Object.entries(values ?? {})) {
			if (Object.hasOwn(merged, name)) {
				throw new Error(
					`Constant "${name}" is defined multiple times across different --define-${kind} flags`
				);
			}
			merged[name] = value;
		}
	}
	return merged;
}

export async function parseOptionsAndRunCLI(
	argsToParse: string[]
): Promise<void> {
	const result = await runNativeCLI({ argv: argsToParse });
	if (result.signal)
		throw new Error(`Native CLI terminated with ${result.signal}.`);
	if (result.code !== 0)
		throw new Error(`Native CLI exited with status ${result.code}.`);
}

export async function runCLI(
	args: RunCLIArgs & { command: 'build-snapshot' | 'run-blueprint' | 'php' }
): Promise<void>;
export async function runCLI(
	args: RunCLIArgs & { command: 'start' | 'server' }
): Promise<RunCLIServer>;
export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer | void>;
export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer | void> {
	if (args.command === 'php')
		unsupported('The native CLI does not support the `php` command.');
	assertSupportedArgs(args);
	if (args.command === 'start' || args.command === 'server') {
		return await startControlledServer(args);
	}
	const serialized = await serializeRunCLIArgs(args);
	try {
		const result = await runNativeCLI({ argv: serialized.argv });
		if (result.signal || result.code !== 0) {
			throw new Error(
				`Native CLI ${args.command} failed with ${result.signal ?? `exit status ${result.code}`}.`
			);
		}
	} finally {
		await serialized.cleanup();
	}
}

async function startControlledServer(args: RunCLIArgs): Promise<RunCLIServer> {
	let nativeServerUrl: URL | undefined;
	const proxyServer = createServer((request, response) => {
		if (!nativeServerUrl) {
			response.writeHead(503, {
				'content-type': 'text/plain',
				'retry-after': '1',
			});
			response.end('Native Playground is starting');
			return;
		}
		proxyHttpRequest(request, response, nativeServerUrl);
	});
	await listenForCommand(proxyServer, args.command, args.port);
	let serialized: SerializedArgs | undefined;
	let child: ChildProcess | undefined;
	let client: NativeControlClient | undefined;
	let handshakeDirectory: string | undefined;
	let stderr = '';
	try {
		const address = proxyServer.address();
		if (!address || typeof address === 'string')
			throw new Error('Could not inspect native CLI proxy address.');
		const proxyUrl = `http://127.0.0.1:${address.port}`;
		const nativeSiteUrl = args['site-url'] ?? proxyUrl;
		const credentials = await createControlCredentials();
		handshakeDirectory = credentials.handshakeDirectory;
		serialized = await serializeRunCLIArgs({
			...args,
			port: 0,
			'site-url': nativeSiteUrl,
		});
		serialized.argv.push(
			'--experimental-control-handshake',
			credentials.handshakePath
		);
		const installation = await ensureNativeHost();
		child = spawn(installation.executablePath, serialized.argv, {
			cwd: process.cwd(),
			env: {
				...process.env,
				WP_PLAYGROUND_NATIVE_ASSET_ROOT: installation.assetRoot,
				WP_PLAYGROUND_NATIVE_DISABLE_SOURCE_FALLBACK: '1',
				WP_PLAYGROUND_NATIVE_CONTROL_TOKEN: credentials.token,
			},
			stdio: ['inherit', 'inherit', 'pipe'],
			windowsHide: true,
		});
		child.stderr?.on('data', (chunk: Buffer) => {
			process.stderr.write(chunk);
			stderr = `${stderr}${chunk}`.slice(-65_536);
		});
		const handshake = await waitForControlHandshake(
			child,
			credentials.handshakePath,
			startupTimeoutMs(args.startupTimeoutMs)
		);
		await rm(credentials.handshakeDirectory, {
			recursive: true,
			force: true,
		});
		handshakeDirectory = undefined;
		nativeServerUrl = new URL(handshake.nativeServerUrl);
		client = new NativeControlClient(
			handshake.controlUrl,
			credentials.token
		);
		const playground = createPlaygroundProxy(
			client
		) as unknown as PlaygroundCliWorker;
		let disposePromise: Promise<void> | undefined;
		const dispose = () =>
			(disposePromise ??= disposeControlledServer(
				proxyServer,
				child!,
				client!,
				serialized!
			));
		child.once('exit', () => void dispose());
		return {
			playground,
			server: proxyServer,
			serverUrl: proxyUrl,
			[internalsKeyForTesting]: {
				workerThreadCount: handshake.workerCount,
			},
			[Symbol.asyncDispose]: dispose,
		};
	} catch (cause) {
		client?.close();
		await Promise.allSettled([
			closeServer(proxyServer),
			child ? stopChild(child) : Promise.resolve(),
		]);
		await Promise.allSettled([
			serialized?.cleanup() ?? Promise.resolve(),
			handshakeDirectory
				? rm(handshakeDirectory, { recursive: true, force: true })
				: Promise.resolve(),
		]);
		if (stderr) {
			throw new NativeCLIError(
				NativeCLIErrorCode.Protocol,
				`Native CLI control startup failed. Native stderr:\n${stderr}`,
				{ cause }
			);
		}
		throw cause;
	}
}

async function disposeControlledServer(
	proxyServer: Server,
	child: ChildProcess,
	client: NativeControlClient,
	serialized: SerializedArgs
): Promise<void> {
	try {
		await client.call('dispose');
	} catch {
		// The host may already have exited.
	}
	client.close();
	const processCleanup = await Promise.allSettled([
		closeServer(proxyServer),
		stopChild(child),
	]);
	const temporaryCleanup = await Promise.allSettled([serialized.cleanup()]);
	const failed = [...processCleanup, ...temporaryCleanup].find(
		(result): result is PromiseRejectedResult =>
			result.status === 'rejected'
	);
	if (failed) throw failed.reason;
}

function startupTimeoutMs(configured?: number): number {
	const value =
		configured ??
		(process.env['WP_PLAYGROUND_NATIVE_STARTUP_TIMEOUT_MS'] === undefined
			? 180_000
			: Number(process.env['WP_PLAYGROUND_NATIVE_STARTUP_TIMEOUT_MS']));
	if (!Number.isFinite(value) || value <= 0) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Configuration,
			'Native CLI startup timeout must be a positive number of milliseconds.'
		);
	}
	return value;
}

interface SerializedArgs {
	argv: string[];
	cleanup(): Promise<void>;
}

async function serializeRunCLIArgs(args: RunCLIArgs): Promise<SerializedArgs> {
	const argv: string[] = [args.command];
	let temporaryDirectory: string | undefined;
	const scalar = (flag: string, value: unknown) => {
		if (value !== undefined) argv.push(`--${flag}`, String(value));
	};
	scalar('wp', args.wp);
	scalar('php', args.php);
	scalar('port', args.port);
	scalar('site-url', args['site-url']);
	scalar('path', args.path);
	scalar('outfile', args.outfile);
	scalar('workers', args.workers);
	scalar('verbosity', args.verbosity);
	scalar('wordpress-install-mode', args.wordpressInstallMode);
	for (const [flag, value] of [
		['debug', args.debug],
		['quiet', args.quiet],
		['reset', args.reset],
		['skip-browser', args.skipBrowser],
		['skip-sqlite-setup', args.skipSqliteSetup],
		['follow-symlinks', args.followSymlinks],
		[
			'blueprint-may-read-adjacent-files',
			args['blueprint-may-read-adjacent-files'],
		],
	] as const)
		if (value) argv.push(`--${flag}`);
	if (args.login !== undefined)
		argv.push(args.login ? '--login' : '--no-login');
	if (args.autoMount === false) argv.push('--no-auto-mount');
	else if (args.autoMount !== undefined) {
		argv.push('--auto-mount');
		if (typeof args.autoMount === 'string') argv.push(args.autoMount);
	}
	for (const [flag, mounts] of [
		['mount-dir', args.mount],
		['mount-dir-before-install', args['mount-before-install']],
	] as const) {
		for (const mount of mounts ?? [])
			argv.push(`--${flag}`, mount.hostPath, mount.vfsPath);
	}
	for (const [flag, values] of [
		['define', args.define],
		['define-bool', args['define-bool']],
		['define-number', args['define-number']],
	] as const) {
		for (const [name, value] of Object.entries(values ?? {}))
			argv.push(`--${flag}`, name, String(value));
	}
	if (args.blueprint !== undefined) {
		if (typeof args.blueprint === 'string')
			scalar('blueprint', args.blueprint);
		else {
			temporaryDirectory = await mkdtemp(
				join(tmpdir(), 'wp-playground-native-blueprint-')
			);
			try {
				const path = join(temporaryDirectory, 'blueprint.json');
				await writeFile(path, JSON.stringify(args.blueprint), {
					mode: 0o600,
				});
				scalar('blueprint', path);
			} catch (cause) {
				await rm(temporaryDirectory, {
					recursive: true,
					force: true,
				});
				throw cause;
			}
		}
	}
	return {
		argv,
		async cleanup() {
			if (temporaryDirectory)
				await rm(temporaryDirectory, { recursive: true, force: true });
		},
	};
}

const unsupportedKeys = new Map<string, string>([
	['pathAliases', 'path aliases'],
	['experimentalTrace', 'request tracing'],
	['internalCookieStore', 'Node cookie-store mediation'],
	['intl', 'Intl extension'],
	['phpmyadmin', 'phpMyAdmin installation'],
	['redis', 'Redis extension'],
	['memcached', 'Memcached extension'],
	['xdebug', 'Xdebug'],
	['phpExtension', 'dynamic PHP extensions'],
	['experimentalUnsafeIdeIntegration', 'unsafe IDE integration'],
	['experimentalDevtools', 'browser devtools bridge'],
	['additional-blueprint-steps', 'additional Blueprint steps'],
	['mode', 'Blueprints v2 mode selection'],
	['db-engine', 'Blueprints v2 database options'],
]);

const supportedKeys = new Set([
	'_',
	'command',
	'blueprint',
	'debug',
	'login',
	'mount',
	'mount-before-install',
	'outfile',
	'php',
	'port',
	'site-url',
	'quiet',
	'verbosity',
	'wp',
	'autoMount',
	'workers',
	'wordpressInstallMode',
	'define',
	'define-bool',
	'define-number',
	'skipSqliteSetup',
	'followSymlinks',
	'blueprint-may-read-adjacent-files',
	'path',
	'skipBrowser',
	'reset',
	'startupTimeoutMs',
]);

function assertSupportedArgs(args: RunCLIArgs): void {
	for (const [key, value] of Object.entries(args)) {
		if (value === undefined || value === false || supportedKeys.has(key))
			continue;
		const description =
			unsupportedKeys.get(key) ?? `the programmatic option \`${key}\``;
		unsupported(`The native CLI does not support ${description}.`);
	}
	if (args._?.some((token) => token !== args.command)) {
		unsupported(
			'The native CLI programmatic API does not support additional positional arguments in `_`.'
		);
	}
	for (const mount of [
		...(args.mount ?? []),
		...(args['mount-before-install'] ?? []),
	]) {
		const extra = Object.keys(mount).filter(
			(key) => !['hostPath', 'vfsPath'].includes(key)
		);
		if (extra.length > 0) {
			unsupported(
				`The native CLI mount API does not support: ${extra.join(', ')}.`
			);
		}
	}
}

function unsupported(message: string): never {
	throw new NativeCLIError(NativeCLIErrorCode.Unsupported, message);
}

function listen(server: Server, port: number): Promise<void> {
	return new Promise((resolvePromise, reject) => {
		const onError = (error: Error) => {
			server.off('listening', onListening);
			reject(error);
		};
		const onListening = () => {
			server.off('error', onError);
			resolvePromise();
		};
		server.once('error', onError);
		server.once('listening', onListening);
		try {
			server.listen(port, '127.0.0.1');
		} catch (cause) {
			server.off('error', onError);
			server.off('listening', onListening);
			reject(cause);
		}
	});
}

async function listenForCommand(
	server: Server,
	command: RunCLIArgs['command'],
	explicitPort: number | undefined
): Promise<void> {
	const preferredPort = explicitPort ?? (command === 'start' ? 0 : 9400);
	try {
		await listen(server, preferredPort);
	} catch (cause) {
		if (
			explicitPort === undefined &&
			command === 'server' &&
			(cause as NodeJS.ErrnoException).code === 'EADDRINUSE'
		) {
			await listen(server, 0);
			return;
		}
		throw cause;
	}
}

function closeServer(server: Server): Promise<void> {
	if (!server.listening) return Promise.resolve();
	return new Promise((resolvePromise) => {
		server.close(() => resolvePromise());
		server.closeAllConnections?.();
	});
}

function proxyHttpRequest(
	request: IncomingMessage,
	response: ServerResponse,
	target: URL
): void {
	const requestTarget = request.url ?? '/';
	let url: URL;
	try {
		if (!requestTarget.startsWith('/') || requestTarget.startsWith('//'))
			throw new Error('absolute request targets are not accepted');
		url = new URL(requestTarget, target);
		if (url.origin !== target.origin)
			throw new Error('request target changed the native origin');
	} catch {
		response.writeHead(400, { 'content-type': 'text/plain' });
		response.end('Invalid Playground proxy request target');
		return;
	}
	const makeRequest = url.protocol === 'https:' ? httpsRequest : httpRequest;
	const upstream = makeRequest(
		url,
		{
			method: request.method,
			headers: request.headers,
		},
		(upstreamResponse) => {
			response.writeHead(
				upstreamResponse.statusCode ?? 502,
				upstreamResponse.headers
			);
			upstreamResponse.pipe(response);
		}
	);
	upstream.on('error', (error) => {
		if (!response.headersSent)
			response.writeHead(502, { 'content-type': 'text/plain' });
		response.end(`Native Playground proxy error: ${error.message}`);
	});
	request.pipe(upstream);
}

async function stopChild(child: ChildProcess): Promise<void> {
	if (
		child.exitCode !== null ||
		child.signalCode !== null ||
		child.pid === undefined
	)
		return;
	const exited = new Promise<void>((resolvePromise) => {
		child.once('exit', () => resolvePromise());
		child.once('error', () => resolvePromise());
	});
	try {
		child.kill('SIGTERM');
	} catch {
		return;
	}
	const stopped = await Promise.race([
		exited.then(() => true),
		new Promise<false>((resolvePromise) =>
			setTimeout(() => resolvePromise(false), 5_000)
		),
	]);
	if (stopped === true) return;
	if (child.exitCode === null && child.signalCode === null) {
		try {
			child.kill('SIGKILL');
		} catch {
			return;
		}
		await Promise.race([
			exited,
			new Promise<void>((resolvePromise) =>
				setTimeout(resolvePromise, 5_000)
			),
		]);
	}
}
