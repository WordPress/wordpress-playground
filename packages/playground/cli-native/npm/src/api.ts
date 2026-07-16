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
import { isProxy } from 'node:util/types';
import {
	CLIArgsValidationError,
	NativeCLIError,
	NativeCLIErrorCode,
} from './errors.js';
import {
	assertSupportedArgv,
	commandCompatibility,
	programmaticOptionCompatibility,
} from './compatibility.js';
import { ensureNativeHost } from './host.js';
import {
	createControlCredentials,
	createPlaygroundProxy,
	NativeControlClient,
	waitForControlHandshake,
} from './control.js';
import { parseNativeCLIArgs, runNativeCLI } from './process.js';

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
	/** Positional tokens in their original order; index 0 is the command. */
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
	/** @unsupported Native v1 does not support path aliases. */
	pathAliases?: Array<{ from: string; to: string }>;
	/** @unsupported Native v1 does not expose Node request tracing. */
	experimentalTrace?: boolean;
	/** @unsupported Native v1 does not use the Node cookie store. */
	internalCookieStore?: boolean;
	/** @unsupported Native v1 does not accept injected Blueprint steps. */
	'additional-blueprint-steps'?: unknown[];
	/** @unsupported Native v1 has a fixed extension set. */
	intl?: boolean;
	/** @unsupported Native v1 does not install phpMyAdmin. */
	phpmyadmin?: boolean | string;
	/** @unsupported Native v1 has a fixed extension set. */
	redis?: boolean;
	/** @unsupported Native v1 has a fixed extension set. */
	memcached?: boolean;
	/** @unsupported Native v1 does not expose Xdebug. */
	xdebug?: boolean | Record<string, unknown>;
	/** @unsupported Native v1 cannot load dynamic PHP extensions. */
	phpExtension?: string[];
	/** @unsupported Native v1 does not expose IDE integration. */
	experimentalUnsafeIdeIntegration?: string[];
	/** @unsupported Native v1 does not expose the browser devtools bridge. */
	experimentalDevtools?: boolean;
	workers?: number | 'auto';
	/** @unsupported Use `workers`; the deprecated Node option is not supported. */
	'experimental-multi-worker'?: number;
	wordpressInstallMode?: string;
	define?: Record<string, string>;
	'define-bool'?: Record<string, boolean>;
	'define-number'?: Record<string, number>;
	defaultedDebugConstants?: string[];
	skipSqliteSetup?: boolean;
	followSymlinks?: boolean;
	'blueprint-may-read-adjacent-files'?: boolean;
	/** @unsupported Native v1 does not run Blueprints v2. */
	mode?: 'mount-only' | 'create-new-site' | 'apply-to-existing-site';
	/** @unsupported Native v1 does not run Blueprints v2. */
	hasExplicitBlueprintsV2Mode?: boolean;
	/** @unsupported Native v1 supports its bundled SQLite integration only. */
	'db-engine'?: 'sqlite' | 'mysql';
	/** @unsupported Native v1 does not expose Blueprints v2 database options. */
	'db-host'?: string;
	/** @unsupported Native v1 does not expose Blueprints v2 database options. */
	'db-user'?: string;
	/** @unsupported Native v1 does not expose Blueprints v2 database options. */
	'db-pass'?: string;
	/** @unsupported Native v1 does not expose Blueprints v2 database options. */
	'db-name'?: string;
	/** @unsupported Native v1 does not expose Blueprints v2 database options. */
	'db-path'?: string;
	/** @unsupported Native v1 does not run Blueprints v2. */
	'truncate-new-site-directory'?: boolean;
	/** @unsupported Native v1 does not expose the Blueprints v2 allow list. */
	allow?: string;
	path?: string;
	skipBrowser?: boolean;
	reset?: boolean;
	/** Native-only startup handshake deadline in milliseconds. */
	startupTimeoutMs?: number;
}

export type NativeHTTPMethod =
	| 'GET'
	| 'POST'
	| 'HEAD'
	| 'OPTIONS'
	| 'PATCH'
	| 'PUT'
	| 'DELETE';

export type NativeMultipartBody = Record<string, string | Uint8Array | File>;

export interface NativePlaygroundRequest {
	url: string;
	method?: NativeHTTPMethod;
	headers?: Record<string, string>;
	body?: string | Uint8Array | NativeMultipartBody;
}

export interface NativePlaygroundRunOptions {
	code?: string;
	scriptPath?: string;
	relativeUri?: string;
	protocol?: string;
	method?: NativeHTTPMethod;
	headers?: Record<string, string>;
	body?: string | Uint8Array;
	env?: Record<string, string>;
	server?: Record<string, string>;
	$_SERVER?: Record<string, string>;
}

export interface NativePHPResponse {
	readonly headers: Record<string, string[]>;
	readonly bytes: Uint8Array;
	readonly errors: string;
	readonly exitCode: number;
	readonly httpStatusCode: number;
	readonly text: string;
	readonly json: unknown;
	ok(): boolean;
	toRawData(): {
		httpStatusCode: number;
		headers: Record<string, string[]>;
		bytes: Uint8Array;
		errors: string;
		exitCode: number;
	};
}

export interface NativeStreamedPHPResponse {
	readonly stdout: ReadableStream<Uint8Array>;
	readonly stderr: ReadableStream<Uint8Array>;
	readonly exitCode: Promise<number>;
	readonly finished: Promise<void>;
	readonly headers: Promise<Record<string, string[]>>;
	readonly httpStatusCode: Promise<number>;
	readonly stdoutBytes: Promise<Uint8Array>;
	readonly stdoutText: Promise<string>;
	readonly stderrText: Promise<string>;
	getHeadersStream(): ReadableStream<Uint8Array>;
	ok(): Promise<boolean>;
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
	rmdir(path: string, options?: { recursive?: boolean }): Promise<void>;
	listFiles(
		path: string,
		options?: { prependPath: boolean }
	): Promise<string[]>;
	isDir(path: string): Promise<boolean>;
	isFile(path: string): Promise<boolean>;
	fileExists(path: string): Promise<boolean>;
	chdir(path: string): Promise<void>;
	cwd(): Promise<string>;
	defineConstant(
		name: string,
		value: string | number | boolean | null
	): Promise<void>;
	pathToInternalUrl(path: string): Promise<string>;
	internalUrlToPath(url: string): Promise<string>;
	/** @unsupported Native v1 does not expose PHP CLI streaming. */
	cli(
		argv: string[],
		options?: { env?: Record<string, string> }
	): Promise<never>;
	addEventListener(
		type: NativePlaygroundEventType,
		listener: NativePlaygroundEventListener
	): void;
	removeEventListener(
		type: NativePlaygroundEventType,
		listener: NativePlaygroundEventListener
	): void;
	/** @unsupported Native v1 does not expose PHP-to-JavaScript messages. */
	onMessage(listener: (data: string) => unknown): never;
}

export type NativePlaygroundEventType =
	| 'request.end'
	| 'request.error'
	| 'filesystem.write'
	| 'ready'
	| 'shutdown';

export type NativePlaygroundEvent =
	| { type: 'request.end'; data?: unknown }
	| {
			type: 'request.error';
			error: Error;
			source?: 'request' | 'php-wasm';
			data?: unknown;
	  }
	| { type: 'filesystem.write'; data?: unknown }
	| { type: 'ready' | 'shutdown'; data: unknown };

export type NativePlaygroundEventListener = (
	event: NativePlaygroundEvent
) => void;

export type PlaygroundCliWorker = NativePlaygroundWorker;
export const internalsKeyForTesting = Symbol('playground-cli-testing');

export interface RunCLIServer extends AsyncDisposable {
	playground: PlaygroundCliWorker;
	server: Server;
	serverUrl: string;
	[Symbol.asyncDispose](): Promise<void>;
	[internalsKeyForTesting]: { workerThreadCount: number };
}

export interface CLIExitResult {
	exitCode: number;
}

export interface CLIServerResult extends AsyncDisposable {
	[Symbol.asyncDispose](): Promise<void>;
	[internalsKeyForTesting]: { cliServer: RunCLIServer };
}

export type ParseCLIResult = CLIExitResult | CLIServerResult;

export function resolveWorkerCount(value: number | 'auto' | undefined): number {
	const cpusMinusOne = Math.min(
		MAX_NATIVE_WORKERS,
		Math.max(1, cpus().length - 1)
	);
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
): Promise<ParseCLIResult> {
	let argv: string[];
	try {
		argv = assertSupportedArgv(argsToParse);
	} catch (cause) {
		if (cause instanceof CLIArgsValidationError) {
			console.error(cause.message);
			return { exitCode: cause.exitCode };
		}
		throw cause;
	}
	const cwd = process.cwd();
	if (!isImmediateCLIInvocation(argv)) {
		const parsed = await parseNativeCLIArgs(argv, { cwd });
		if (parsed.status === 'invalid') {
			console.error(parsed.message);
			return { exitCode: parsed.exitCode };
		}
		if (parsed.command === 'start' || parsed.command === 'server') {
			const cliServer = await startControlledServerFromArgv(
				argv,
				parsed,
				cwd
			);
			return {
				[internalsKeyForTesting]: { cliServer },
				[Symbol.asyncDispose]: () => cliServer[Symbol.asyncDispose](),
			};
		}
	}
	let result: Awaited<ReturnType<typeof runNativeCLI>>;
	try {
		result = await runNativeCLI({ argv, cwd });
	} catch (cause) {
		throw nativeSpawnError(cause);
	}
	if (result.signal)
		throw new NativeCLIError(
			NativeCLIErrorCode.Exit,
			`Native CLI terminated with ${result.signal}.`,
			{ details: { signal: result.signal } }
		);
	if (result.code !== 0)
		throw new NativeCLIError(
			NativeCLIErrorCode.Exit,
			`Native CLI exited with status ${result.code}.`,
			{ details: { exitCode: result.code ?? undefined } }
		);
	return { exitCode: 0 };
}

function isImmediateCLIInvocation(argv: string[]): boolean {
	return (
		argv[0] === 'runtime' ||
		(argv.length === 1 &&
			['--help', '-h', '--version', '-V'].includes(argv[0]!)) ||
		argv.slice(1).some((argument) => ['--help', '-h'].includes(argument))
	);
}

export async function runCLI(
	args: RunCLIArgs & { command: 'build-snapshot' | 'run-blueprint' | 'php' }
): Promise<void>;
export async function runCLI(
	args: RunCLIArgs & { command: 'start' | 'server' }
): Promise<RunCLIServer>;
export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer | void>;
export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer | void> {
	const snapshot = snapshotSupportedArgs(args);
	const validatedArgs = snapshot.args;
	const blueprintJSON = await materializeBlueprintJSON(
		snapshot.blueprintJSON,
		validatedArgs
	);
	if (
		validatedArgs.command === 'start' ||
		validatedArgs.command === 'server'
	) {
		return await startControlledServer(validatedArgs, blueprintJSON);
	}
	const serialized = await serializeRunCLIArgs(validatedArgs, blueprintJSON);
	let hasInitiatingFailure = false;
	try {
		let result: Awaited<ReturnType<typeof runNativeCLI>>;
		try {
			result = await runNativeCLI({ argv: serialized.argv });
		} catch (cause) {
			throw nativeSpawnError(cause, validatedArgs.command);
		}
		if (result.signal || result.code !== 0) {
			throw new NativeCLIError(
				NativeCLIErrorCode.Exit,
				`Native CLI ${validatedArgs.command} failed with ${result.signal ?? `exit status ${result.code}`}.`,
				{
					details: {
						command: validatedArgs.command,
						exitCode: result.code ?? undefined,
						signal: result.signal ?? undefined,
					},
				}
			);
		}
	} catch (cause) {
		hasInitiatingFailure = true;
		throw cause;
	} finally {
		try {
			await serialized.cleanup();
		} catch (cleanupFailure) {
			if (!hasInitiatingFailure) throw cleanupFailure;
		}
	}
}

async function materializeBlueprintJSON(
	source: string | Promise<string> | undefined,
	args: RunCLIArgs
): Promise<string | undefined> {
	if (source === undefined) return undefined;
	let text: string;
	try {
		text = await source;
	} catch (cause) {
		if (cause instanceof NativeCLIError) throw cause;
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			'Native CLI could not read blueprint.json from the Blueprint bundle.',
			{ cause }
		);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (cause) {
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			'Native CLI Blueprint bundle blueprint.json is not valid JSON.',
			{ cause }
		);
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
		invalidRequest('Native CLI Blueprint JSON must be an object.');

	const blueprint = snapshotJSONValue(parsed, new WeakSet(), 'blueprint', 0, {
		nodes: 0,
	}) as Record<string, unknown>;
	translateBlueprintTopLevel(blueprint, args);
	const translated = snapshotJSONValue(
		blueprint,
		new WeakSet(),
		'blueprint',
		0,
		{ nodes: 0 }
	);
	let json: string;
	try {
		json = JSON.stringify(translated);
	} catch (cause) {
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			'Native CLI Blueprint could not be serialized as JSON.',
			{ cause }
		);
	}
	if (Buffer.byteLength(json, 'utf8') > MAX_BLUEPRINT_JSON_BYTES)
		invalidRequest(
			`Native CLI blueprint JSON must not exceed ${MAX_BLUEPRINT_JSON_BYTES} bytes.`
		);
	return json;
}

function translateBlueprintTopLevel(
	blueprint: Record<string, unknown>,
	args: RunCLIArgs
): void {
	if (blueprint['preferredVersions'] !== undefined) {
		const preferredVersions = snapshotPlainRecord(
			blueprint['preferredVersions'],
			'Native CLI Blueprint preferredVersions'
		);
		const keys = Object.keys(preferredVersions).sort();
		if (keys.length !== 2 || keys[0] !== 'php' || keys[1] !== 'wp')
			invalidRequest(
				'Native CLI Blueprint preferredVersions must contain only php and wp.'
			);
		const php = preferredVersions['php'];
		if (php !== '8.2')
			invalidRequest(
				'Native CLI Blueprint preferredVersions.php must be the supported value "8.2".'
			);
		const wp = preferredVersions['wp'];
		if (wp === false)
			unsupported(
				'Native CLI v1 does not support preferredVersions.wp=false PHP-only Blueprints.'
			);
		if (typeof wp !== 'string' || wp.length === 0)
			invalidRequest(
				'Native CLI Blueprint preferredVersions.wp must be a non-empty string.'
			);
		assertNoNul(wp, 'Native CLI Blueprint preferredVersions.wp');
		args.php = php;
		args.wp = wp;
		delete blueprint['preferredVersions'];
	}

	if (blueprint['constants'] !== undefined) {
		const constants = snapshotPlainRecord(
			blueprint['constants'],
			'Native CLI Blueprint constants'
		);
		for (const [name, value] of Object.entries(constants)) {
			if (name.length === 0)
				invalidRequest(
					'Native CLI Blueprint constant names must not be empty.'
				);
			assertNoNul(name, 'Native CLI Blueprint constant name');
			if (
				typeof value !== 'string' &&
				typeof value !== 'boolean' &&
				(typeof value !== 'number' || !Number.isFinite(value))
			)
				invalidRequest(
					`Native CLI Blueprint constant \`${name}\` must be a string, boolean, or finite number.`
				);
			if (typeof value === 'string')
				assertNoNul(value, `Native CLI Blueprint constant \`${name}\``);
		}
		const steps = blueprint['steps'];
		if (steps !== undefined && !Array.isArray(steps))
			invalidRequest('Native CLI Blueprint steps must be an array.');
		blueprint['steps'] = [
			{ step: 'defineWpConfigConsts', consts: constants },
			...((steps ?? []) as unknown[]),
		];
		delete blueprint['constants'];
	}
}

async function startControlledServer(
	args: RunCLIArgs,
	blueprintJSON?: string
): Promise<RunCLIServer> {
	const cwd = process.cwd();
	return await startControlledServerWithLaunch({
		command: args.command as 'start' | 'server',
		explicitPort: args.port,
		startupTimeout: args.startupTimeoutMs,
		cwd,
		prepare: async (proxyUrl) => {
			const nativeSiteUrl = args['site-url'] ?? proxyUrl;
			return await serializeRunCLIArgs(
				{
					...args,
					port: 0,
					'site-url': nativeSiteUrl,
				},
				blueprintJSON
			);
		},
	});
}

async function startControlledServerFromArgv(
	argv: string[],
	parsed: {
		command: 'start' | 'server';
		port: number | null;
		siteUrl: string | null;
	},
	cwd: string
): Promise<RunCLIServer> {
	return await startControlledServerWithLaunch({
		command: parsed.command,
		explicitPort: parsed.port ?? undefined,
		cwd,
		prepare: async (proxyUrl) => ({
			argv: controlledServerArgv(
				argv,
				parsed.siteUrl === null ? proxyUrl : undefined
			),
			cleanup: async () => {},
		}),
	});
}

interface ControlledServerLaunch {
	command: 'start' | 'server';
	explicitPort?: number;
	startupTimeout?: number;
	cwd: string;
	prepare(proxyUrl: string): Promise<SerializedArgs>;
}

async function startControlledServerWithLaunch(
	launch: ControlledServerLaunch
): Promise<RunCLIServer> {
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
	await listenForCommand(proxyServer, launch.command, launch.explicitPort);
	let serialized: SerializedArgs | undefined;
	let child: ChildProcess | undefined;
	let client: NativeControlClient | undefined;
	let handshakeDirectory: string | undefined;
	let controlToken: string | undefined;
	let stderr = '';
	try {
		const address = proxyServer.address();
		if (!address || typeof address === 'string')
			throw new Error('Could not inspect native CLI proxy address.');
		const proxyUrl = `http://127.0.0.1:${address.port}`;
		const credentials = await createControlCredentials();
		controlToken = credentials.token;
		handshakeDirectory = credentials.handshakeDirectory;
		serialized = await launch.prepare(proxyUrl);
		serialized.argv.push(
			'--experimental-control-handshake',
			credentials.handshakePath
		);
		const installation = await ensureNativeHost();
		child = spawn(installation.executablePath, serialized.argv, {
			cwd: launch.cwd,
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
			startupTimeoutMs(launch.startupTimeout)
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
				NativeCLIErrorCode.Startup,
				`Native CLI control startup failed. Native stderr:\n${redactSecret(stderr, controlToken)}`,
				{ cause }
			);
		}
		throw cause;
	}
}

function controlledServerArgv(
	argv: readonly string[],
	defaultSiteUrl: string | undefined
): string[] {
	const controlled: string[] = [];
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index]!;
		if (argument === '--port') {
			if (index + 1 >= argv.length)
				invalidRequest('Native CLI --port requires a value.');
			index++;
			continue;
		}
		if (argument.startsWith('--port=')) continue;
		controlled.push(argument);
	}
	controlled.push('--port', '0');
	if (defaultSiteUrl !== undefined)
		controlled.push('--site-url', defaultSiteUrl);
	return controlled;
}

function redactSecret(message: string, secret: string | undefined): string {
	return secret ? message.replaceAll(secret, '[redacted]') : message;
}

function nativeSpawnError(cause: unknown, command?: string): NativeCLIError {
	if (cause instanceof NativeCLIError) return cause;
	return new NativeCLIError(
		NativeCLIErrorCode.Spawn,
		`Could not spawn the native CLI${command ? ` for ${command}` : ''}.`,
		{ cause, details: command ? { command } : undefined }
	);
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

async function serializeRunCLIArgs(
	args: RunCLIArgs,
	blueprintJSON?: string
): Promise<SerializedArgs> {
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
			try {
				temporaryDirectory = await mkdtemp(
					join(tmpdir(), 'wp-playground-native-blueprint-')
				);
				const path = join(temporaryDirectory, 'blueprint.json');
				if (blueprintJSON === undefined)
					invalidRequest(
						'Native CLI Blueprint serialization was not validated.'
					);
				await writeFile(path, blueprintJSON, {
					mode: 0o600,
				});
				scalar('blueprint', path);
			} catch (cause) {
				try {
					if (temporaryDirectory)
						await rm(temporaryDirectory, {
							recursive: true,
							force: true,
						});
				} catch {
					// Preserve the initiating serialization failure.
				}
				if (cause instanceof NativeCLIError) throw cause;
				throw new NativeCLIError(
					NativeCLIErrorCode.IO,
					'Could not write the validated native CLI Blueprint.',
					{ cause }
				);
			}
		}
	}
	return {
		argv,
		async cleanup() {
			if (!temporaryDirectory) return;
			try {
				await rm(temporaryDirectory, { recursive: true, force: true });
			} catch (cause) {
				throw new NativeCLIError(
					NativeCLIErrorCode.IO,
					'Could not remove the native CLI Blueprint temporary directory.',
					{ cause }
				);
			}
		},
	};
}

const MAX_NATIVE_WORKERS = 256;
const MAX_BLUEPRINT_DEPTH = 64;
const MAX_BLUEPRINT_NODES = 100_000;
const MAX_BLUEPRINT_JSON_BYTES = 16 * 1024 * 1024;

interface SupportedArgsSnapshot {
	args: RunCLIArgs;
	blueprintJSON?: string | Promise<string>;
}

function snapshotSupportedArgs(value: unknown): SupportedArgsSnapshot {
	try {
		return snapshotSupportedArgsUnchecked(value);
	} catch (cause) {
		if (cause instanceof NativeCLIError) throw cause;
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			'Native CLI arguments could not be inspected safely.',
			{ cause }
		);
	}
}

function snapshotSupportedArgsUnchecked(value: unknown): SupportedArgsSnapshot {
	const args = snapshotPlainRecord(value, 'Native CLI arguments') as Record<
		string,
		unknown
	> &
		RunCLIArgs;
	if (!Object.hasOwn(args, 'command'))
		invalidRequest('Native CLI command must be an own property.');
	const command = args.command;
	if (typeof command !== 'string')
		invalidRequest('Native CLI command must be a string.');
	assertNoNul(command, 'Native CLI command');
	const commandEntry = commandCompatibility(command);
	if (!commandEntry)
		invalidRequest(`Unknown native CLI command \`${command}\`.`);
	if (commandEntry.status === 'unsupported-by-design')
		unsupported(
			commandEntry.diagnostic ??
				`The native CLI does not support the \`${command}\` command.`
		);

	for (const key of Object.keys(args)) {
		assertNoNul(key, 'Native CLI option name');
		const propertyValue = args[key];
		const compatibility = programmaticOptionCompatibility(key);
		if (!compatibility)
			unsupported(
				`The native CLI does not support the programmatic option \`${key}\`.`
			);
		if (propertyValue === undefined) {
			delete args[key];
			continue;
		}
		if (
			compatibility.status === 'unsupported-by-design' &&
			compatibility.allowFalse === true &&
			propertyValue === false
		) {
			if (!compatibility.commands?.includes(command))
				invalidRequest(
					`Native CLI option \`${key}\` is not supported by the ${command} command.`
				);
			delete args[key];
			continue;
		}
		if (compatibility.status === 'unsupported-by-design')
			unsupported(
				`The native CLI does not support ${compatibility.diagnostic ?? `the programmatic option \`${key}\``}.`
			);
		if (!compatibility.commands?.includes(command))
			invalidRequest(
				`Native CLI option \`${key}\` is not supported by the ${command} command.`
			);
	}

	if (args._ !== undefined) {
		args._ = snapshotDenseArray(
			args._,
			'Native CLI positional arguments in `_`'
		).map((token) => {
			if (typeof token !== 'string')
				invalidRequest(
					'Native CLI positional arguments in `_` must contain only strings.'
				);
			assertNoNul(token, 'Native CLI positional argument');
			return token;
		});
		if (
			args._.length > 1 ||
			(args._.length === 1 && args._[0] !== args.command)
		)
			unsupported(
				'The native CLI programmatic API does not support additional positional arguments in `_`.'
			);
	}

	for (const key of [
		'debug',
		'login',
		'quiet',
		'skipSqliteSetup',
		'followSymlinks',
		'blueprint-may-read-adjacent-files',
		'skipBrowser',
		'reset',
	] as const) {
		if (args[key] !== undefined && typeof args[key] !== 'boolean')
			invalidRequest(`Native CLI ${key} must be a boolean.`);
	}
	for (const key of ['outfile', 'site-url', 'wp', 'path'] as const) {
		const propertyValue = args[key];
		if (
			propertyValue !== undefined &&
			(typeof propertyValue !== 'string' || propertyValue.length === 0)
		)
			invalidRequest(`Native CLI ${key} must be a non-empty string.`);
		if (propertyValue !== undefined)
			assertNoNul(propertyValue, `Native CLI ${key}`);
	}
	if (args.php !== undefined) {
		if (args.php !== '8.2')
			invalidRequest('Native CLI php must be the supported value "8.2".');
		assertNoNul(args.php, 'Native CLI php');
	}
	if (
		args.verbosity !== undefined &&
		!['quiet', 'normal', 'debug'].includes(args.verbosity)
	)
		invalidRequest('Native CLI verbosity must be quiet, normal, or debug.');
	if (args.verbosity !== undefined)
		assertNoNul(args.verbosity, 'Native CLI verbosity');
	if (
		args.wordpressInstallMode !== undefined &&
		![
			'download-and-install',
			'install-from-existing-files',
			'install-from-existing-files-if-needed',
			'do-not-attempt-installing',
		].includes(args.wordpressInstallMode)
	)
		invalidRequest('Native CLI wordpressInstallMode is invalid.');
	if (args.wordpressInstallMode !== undefined)
		assertNoNul(
			args.wordpressInstallMode,
			'Native CLI wordpressInstallMode'
		);
	if (
		args.port !== undefined &&
		(!Number.isInteger(args.port) || args.port < 0 || args.port > 65_535)
	)
		invalidRequest(
			'Native CLI port must be an integer from 0 through 65535.'
		);
	if (
		args.workers !== undefined &&
		args.workers !== 'auto' &&
		(!Number.isSafeInteger(args.workers) ||
			args.workers < 1 ||
			args.workers > MAX_NATIVE_WORKERS)
	)
		invalidRequest(
			`Native CLI workers must be an integer from 1 through ${MAX_NATIVE_WORKERS}, or "auto".`
		);
	if (
		args.startupTimeoutMs !== undefined &&
		(!Number.isSafeInteger(args.startupTimeoutMs) ||
			args.startupTimeoutMs < 1 ||
			args.startupTimeoutMs > 2_147_483_647)
	)
		invalidRequest(
			'Native CLI startupTimeoutMs must be an integer from 1 through 2147483647.'
		);
	if (
		args.autoMount !== undefined &&
		typeof args.autoMount !== 'boolean' &&
		(typeof args.autoMount !== 'string' || args.autoMount.length === 0)
	)
		invalidRequest(
			'Native CLI autoMount must be a boolean or non-empty string.'
		);
	if (typeof args.autoMount === 'string')
		assertNoNul(args.autoMount, 'Native CLI autoMount');
	args.mount = snapshotMounts(args.mount, 'mount');
	args['mount-before-install'] = snapshotMounts(
		args['mount-before-install'],
		'mount-before-install'
	);
	args.define = snapshotDefineRecord(args.define, 'define', 'string');
	args['define-bool'] = snapshotDefineRecord(
		args['define-bool'],
		'define-bool',
		'boolean'
	);
	args['define-number'] = snapshotDefineRecord(
		args['define-number'],
		'define-number',
		'number'
	);
	const definedNames = new Set<string>();
	for (const definitions of [
		args.define,
		args['define-bool'],
		args['define-number'],
	])
		for (const name of Object.keys(definitions ?? {})) {
			if (definedNames.has(name))
				invalidRequest(
					`Native CLI constant \`${name}\` is defined more than once.`
				);
			definedNames.add(name);
		}
	const blueprint = snapshotBlueprint(args.blueprint);
	args.blueprint = blueprint.value;
	return {
		args,
		blueprintJSON: blueprint.json,
	};
}

function snapshotPlainRecord(
	value: unknown,
	description: string
): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value))
		invalidRequest(`${description} must be a plain object.`);
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		invalidRequest(`${description} must be a plain object.`);
	const snapshot = Object.create(null) as Record<string, unknown>;
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== 'string')
			invalidRequest(`${description} may not contain symbol keys.`);
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || !('value' in descriptor))
			invalidRequest(
				`${description} properties must be own data properties.`
			);
		snapshot[key] = descriptor.value;
	}
	return snapshot;
}

function snapshotDenseArray(value: unknown, description: string): unknown[] {
	if (
		!Array.isArray(value) ||
		Object.getPrototypeOf(value) !== Array.prototype
	)
		invalidRequest(`${description} must be an ordinary array.`);
	const keys = Reflect.ownKeys(value);
	if (
		keys.length !== value.length + 1 ||
		!keys.includes('length') ||
		keys.some(
			(key) =>
				typeof key !== 'string' ||
				(key !== 'length' &&
					(!/^(0|[1-9]\d*)$/.test(key) ||
						Number(key) >= value.length))
		)
	)
		invalidRequest(
			`${description} must be dense and may not contain symbols or extra properties.`
		);
	const snapshot: unknown[] = [];
	for (let index = 0; index < value.length; index++) {
		const descriptor = Object.getOwnPropertyDescriptor(
			value,
			String(index)
		);
		if (!descriptor || !('value' in descriptor))
			invalidRequest(
				`${description} entries must be own data properties.`
			);
		snapshot.push(descriptor.value);
	}
	return snapshot;
}

function snapshotBlueprint(value: unknown): {
	value: unknown;
	json?: string | Promise<string>;
} {
	if (value === undefined) return { value: undefined };
	if (typeof value === 'string') {
		if (value.length === 0)
			invalidRequest('Native CLI blueprint must not be an empty string.');
		assertNoNul(value, 'Native CLI blueprint path');
		return { value };
	}
	if (typeof value !== 'object' || value === null || Array.isArray(value))
		invalidRequest(
			'Native CLI blueprint must be a path or plain JSON object.'
		);
	const read = snapshotDataMethod(
		value,
		'read',
		'Native CLI Blueprint filesystem bundle'
	);
	if (read)
		return {
			value: Object.create(null),
			json: readBlueprintBundle(read),
		};
	const budget = { nodes: 0 };
	const snapshot = snapshotJSONValue(
		value,
		new WeakSet(),
		'blueprint',
		0,
		budget
	);
	let json: string;
	try {
		json = JSON.stringify(snapshot);
	} catch (cause) {
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			'Native CLI blueprint could not be serialized as JSON.',
			{ cause }
		);
	}
	if (Buffer.byteLength(json, 'utf8') > MAX_BLUEPRINT_JSON_BYTES)
		invalidRequest(
			`Native CLI blueprint JSON must not exceed ${MAX_BLUEPRINT_JSON_BYTES} bytes.`
		);
	return { value: snapshot, json };
}

function snapshotDataMethod(
	owner: object,
	name: string,
	description: string
): ((...args: unknown[]) => unknown) | undefined {
	let candidate: object | null = owner;
	for (let depth = 0; candidate !== null; depth++) {
		if (isProxy(candidate))
			invalidRequest(`${description} must not be a Proxy.`);
		if (candidate === Object.prototype) return undefined;
		if (depth > MAX_BLUEPRINT_DEPTH)
			invalidRequest(`${description} prototype chain is too deep.`);
		const descriptor = Object.getOwnPropertyDescriptor(candidate, name);
		if (descriptor) {
			if (
				!('value' in descriptor) ||
				typeof descriptor.value !== 'function'
			)
				invalidRequest(
					`${description}.${name} must be a data-property function.`
				);
			const method = descriptor.value as (...args: unknown[]) => unknown;
			return (...args: unknown[]) => Reflect.apply(method, owner, args);
		}
		candidate = Object.getPrototypeOf(candidate);
	}
	return undefined;
}

async function readBlueprintBundle(
	read: (...args: unknown[]) => unknown
): Promise<string> {
	let file: unknown;
	try {
		file = await read('/blueprint.json');
	} catch (cause) {
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			'Native CLI could not read /blueprint.json from the Blueprint filesystem bundle.',
			{ cause }
		);
	}
	if (typeof file !== 'object' || file === null)
		invalidRequest(
			'Native CLI Blueprint filesystem read() must return a streamed file.'
		);
	const streamMethod = snapshotDataMethod(
		file,
		'stream',
		'Native CLI Blueprint streamed file'
	);
	if (!streamMethod)
		invalidRequest(
			'Native CLI Blueprint filesystem read() result must expose stream().'
		);
	let stream: unknown;
	try {
		stream = streamMethod();
	} catch (cause) {
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			'Native CLI could not open the Blueprint filesystem stream.',
			{ cause }
		);
	}
	if (isProxy(stream))
		invalidRequest(
			'Native CLI Blueprint filesystem stream() must not return a Proxy.'
		);
	if (!(stream instanceof ReadableStream))
		invalidRequest(
			'Native CLI Blueprint filesystem stream() must return a ReadableStream.'
		);

	let reader: ReadableStreamDefaultReader<unknown>;
	try {
		reader = ReadableStream.prototype.getReader.call(
			stream
		) as ReadableStreamDefaultReader<unknown>;
	} catch (cause) {
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			'Native CLI could not acquire the Blueprint filesystem stream reader.',
			{ cause }
		);
	}
	const chunks: Buffer[] = [];
	let length = 0;
	try {
		for (;;) {
			const result = await reader.read();
			if (result.done) break;
			if (isProxy(result.value) || !(result.value instanceof Uint8Array))
				invalidRequest(
					'Native CLI Blueprint filesystem stream must contain Uint8Array chunks.'
				);
			const chunk = Buffer.from(result.value);
			length += chunk.byteLength;
			if (length > MAX_BLUEPRINT_JSON_BYTES)
				invalidRequest(
					`Native CLI blueprint JSON must not exceed ${MAX_BLUEPRINT_JSON_BYTES} bytes.`
				);
			chunks.push(chunk);
		}
	} catch (cause) {
		await reader.cancel().catch(() => undefined);
		if (cause instanceof NativeCLIError) throw cause;
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			'Native CLI could not read the Blueprint filesystem stream.',
			{ cause }
		);
	} finally {
		reader.releaseLock();
	}
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(
			Buffer.concat(chunks, length)
		);
	} catch (cause) {
		throw new NativeCLIError(
			NativeCLIErrorCode.InvalidRequest,
			'Native CLI Blueprint bundle blueprint.json must be valid UTF-8.',
			{ cause }
		);
	}
}

function snapshotJSONValue(
	value: unknown,
	active: WeakSet<object>,
	path: string,
	depth: number,
	budget: { nodes: number }
): unknown {
	if (depth > MAX_BLUEPRINT_DEPTH)
		invalidRequest(
			`Native CLI blueprint exceeds the maximum depth of ${MAX_BLUEPRINT_DEPTH}.`
		);
	if (++budget.nodes > MAX_BLUEPRINT_NODES)
		invalidRequest(
			`Native CLI blueprint exceeds the maximum node count of ${MAX_BLUEPRINT_NODES}.`
		);
	if (value === null || typeof value === 'boolean') return value;
	if (typeof value === 'string') {
		assertNoNul(value, `Native CLI ${path}`);
		return value;
	}
	if (typeof value === 'number') {
		if (Number.isFinite(value)) return value;
		invalidRequest(`Native CLI ${path} contains a non-finite number.`);
	}
	if (typeof value !== 'object')
		invalidRequest(`Native CLI ${path} is not JSON-serializable.`);
	const object = value as object;
	if (active.has(object))
		invalidRequest(`Native CLI ${path} contains a circular reference.`);
	active.add(object);
	let snapshot: unknown;
	if (Array.isArray(object)) {
		snapshot = snapshotDenseArray(object, `Native CLI ${path}`).map(
			(item, index) =>
				snapshotJSONValue(
					item,
					active,
					`${path}[${index}]`,
					depth + 1,
					budget
				)
		);
	} else {
		const record = snapshotPlainRecord(object, `Native CLI ${path}`);
		const clone = Object.create(null) as Record<string, unknown>;
		for (const [key, item] of Object.entries(record)) {
			assertNoNul(key, `Native CLI ${path} key`);
			clone[key] = snapshotJSONValue(
				item,
				active,
				`${path}.${key}`,
				depth + 1,
				budget
			);
		}
		snapshot = clone;
	}
	active.delete(object);
	return snapshot;
}

function snapshotMounts(
	value: unknown,
	flag: 'mount' | 'mount-before-install'
): Mount[] | undefined {
	if (value === undefined) return undefined;
	return snapshotDenseArray(value, `Native CLI ${flag}`).map((item) => {
		const mount = snapshotPlainRecord(item, `Native CLI ${flag} entry`);
		const keys = Object.keys(mount).sort();
		if (
			keys.length !== 2 ||
			keys[0] !== 'hostPath' ||
			keys[1] !== 'vfsPath'
		)
			invalidRequest(
				'Every native CLI mount must contain only hostPath and vfsPath.'
			);
		if (
			typeof mount.hostPath !== 'string' ||
			mount.hostPath.length === 0 ||
			typeof mount.vfsPath !== 'string' ||
			mount.vfsPath.length === 0
		)
			invalidRequest(
				'Every native CLI mount requires non-empty string hostPath and vfsPath values.'
			);
		assertNoNul(mount.hostPath, 'Native CLI mount hostPath');
		assertNoNul(mount.vfsPath, 'Native CLI mount vfsPath');
		return Object.assign(Object.create(null), mount) as Mount;
	});
}

function snapshotDefineRecord(
	value: unknown,
	flag: 'define' | 'define-bool' | 'define-number',
	type: 'string' | 'boolean' | 'number'
): Record<string, never> | undefined {
	if (value === undefined) return undefined;
	const record = snapshotPlainRecord(value, `Native CLI ${flag}`);
	for (const [name, definition] of Object.entries(record)) {
		if (name.length === 0)
			invalidRequest(`Native CLI ${flag} names must not be empty.`);
		assertNoNul(name, `Native CLI ${flag} name`);
		if (
			typeof definition !== type ||
			(type === 'number' && !Number.isFinite(definition))
		)
			invalidRequest(`Native CLI ${flag} contains an invalid value.`);
		if (typeof definition === 'string')
			assertNoNul(definition, `Native CLI ${flag} value`);
	}
	return record as Record<string, never>;
}

function assertNoNul(value: string, description: string): void {
	if (value.includes('\0'))
		invalidRequest(`${description} may not contain NUL bytes.`);
}

function unsupported(message: string): never {
	throw new NativeCLIError(NativeCLIErrorCode.Unsupported, message);
}

function invalidRequest(message: string): never {
	throw new NativeCLIError(NativeCLIErrorCode.InvalidRequest, message);
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
