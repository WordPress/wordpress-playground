import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import { posix, join, resolve } from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import { LogSeverity } from '@php-wasm/logger';
import type { Pooled } from '@php-wasm/universal';
import type { Mount } from '@php-wasm/cli-util';
import type { PlaygroundCliWorker, RunCLIArgs } from './run-cli';
import {
	runWasmtimeCLI,
	spawnWasmtimeCLI,
	type WasmtimeCLIExit,
} from './wasmtime-binary';
import {
	createWasmtimePlayground,
	type WasmtimePHPCLIResult,
	type WasmtimeVfsMount,
} from './wasmtime-playground';

const wasmtimeReadyFileEnvironmentVariable =
	'WP_PLAYGROUND_WASMTIME_READY_FILE';
const wasmtimeReadyProtocolVersion = 2;
const wasmtimeStartupTimeoutMilliseconds = 120_000;
const wasmtimeShutdownTimeoutMilliseconds = 5_000;
const defaultVfsDirectories = ['/wordpress', '/tmp', '/home', '/tools'];

export const LogVerbosity = {
	Quiet: { name: 'quiet', severity: LogSeverity.Fatal },
	Normal: { name: 'normal', severity: LogSeverity.Info },
	Debug: { name: 'debug', severity: LogSeverity.Debug },
} as const;

export type WorkerType = 'v1' | 'v2';

export const internalsKeyForTesting = Symbol('playground-cli-testing');

export interface RunCLIServer extends AsyncDisposable {
	playground: Pooled<PlaygroundCliWorker>;
	server: Server;
	serverUrl: string;

	[Symbol.asyncDispose](): Promise<void>;

	[internalsKeyForTesting]: {
		workerThreadCount: number;
	};
}

type WasmtimeReadyManifest = {
	protocolVersion: number;
	serverUrl: string;
	siteUrl: string;
	pid: number;
	mounts: WasmtimeVfsMount[];
};

type PreparedWasmtimeInvocation = {
	args: RunCLIArgs;
	root: string;
	mountsBeforeInstall: WasmtimeVfsMount[];
	mounts: WasmtimeVfsMount[];
	blueprintPath?: string;
	cleanup: () => Promise<void>;
};

/**
 * Resolves the Wasmtime host worker count using the long-standing CLI policy.
 */
export function resolveWorkerCount(value: number | 'auto' | undefined): number {
	const cpusMinusOne = Math.max(1, os.cpus().length - 1);
	if (value === undefined) {
		return Math.min(6, cpusMinusOne);
	}
	return value === 'auto' ? cpusMinusOne : value;
}

/**
 * Runs raw command-line arguments through the Wasmtime host.
 *
 * This is the programmatic equivalent of invoking `wp-playground-cli` and is
 * deliberately separate from runCLI(), which starts a server and returns its
 * lifecycle and PHP/VFS facade.
 */
export async function parseOptionsAndRunCLI(
	argsToParse: string[]
): Promise<void> {
	const result = await runWasmtimeCLI(argsToParse, { stdio: 'inherit' });
	ensureWasmtimeCommandSucceeded(
		result,
		argsToParse[0] ?? 'wp-playground-cli'
	);
}

export async function runCLI(
	args: RunCLIArgs & {
		command: 'build-snapshot' | 'run-blueprint' | 'php';
	}
): Promise<void>;
export async function runCLI(
	args: RunCLIArgs & { command: 'start' }
): Promise<RunCLIServer>;
export async function runCLI(
	args: RunCLIArgs & { command: 'server' }
): Promise<RunCLIServer>;
export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer | void>;
export async function runCLI(args: RunCLIArgs): Promise<RunCLIServer | void> {
	assertSupportedProgrammaticOptions(args);
	const invocation = await prepareWasmtimeInvocation(args);
	const commandArgs = wasmtimeArgsFor(invocation, args.command);

	if (args.command !== 'server' && args.command !== 'start') {
		try {
			const result = await runWasmtimeCLI(commandArgs, {
				stdio: 'inherit',
			});
			ensureWasmtimeCommandSucceeded(result, args.command);
		} finally {
			await invocation.cleanup();
		}
		return;
	}

	return await startWasmtimeServer(invocation, commandArgs);
}

async function prepareWasmtimeInvocation(
	args: RunCLIArgs
): Promise<PreparedWasmtimeInvocation> {
	const root = await mkdtemp(join(tmpdir(), 'wp-playground-wasmtime-api-'));
	let cleaned = false;
	const cleanup = async () => {
		if (!cleaned) {
			cleaned = true;
			await rm(root, { recursive: true, force: true });
		}
	};

	try {
		const userMountsBeforeInstall = normalizeMounts(
			args['mount-before-install'] ?? []
		);
		const userMounts = normalizeMounts(args.mount ?? []);
		const suppliedMounts = [...userMountsBeforeInstall, ...userMounts];
		const wrapperMounts: WasmtimeVfsMount[] = [];

		const wrapperDirectories =
			args.command === 'start'
				? defaultVfsDirectories.filter((path) => path !== '/wordpress')
				: defaultVfsDirectories;
		for (const vfsPath of wrapperDirectories) {
			if (suppliedMounts.some((mount) => mount.vfsPath === vfsPath)) {
				continue;
			}
			const hostPath = join(root, 'vfs', vfsPath.slice(1));
			await mkdir(hostPath, { recursive: true });
			wrapperMounts.push({ hostPath, vfsPath });
		}

		let blueprintPath: string | undefined;
		if (args.blueprint && typeof args.blueprint !== 'string') {
			blueprintPath = join(root, 'blueprint.json');
			const blueprint = JSON.stringify(args.blueprint);
			if (blueprint === undefined) {
				throw new Error(
					'Wasmtime runCLI() could not serialize the Blueprint input.'
				);
			}
			await writeFile(blueprintPath, blueprint);
		}

		const mountsBeforeInstall = [
			...wrapperMounts,
			...userMountsBeforeInstall,
		];
		return {
			args,
			root,
			mountsBeforeInstall,
			mounts: userMounts,
			blueprintPath,
			cleanup,
		};
	} catch (error) {
		await cleanup();
		throw error;
	}
}

async function startWasmtimeServer(
	invocation: PreparedWasmtimeInvocation,
	commandArgs: string[]
): Promise<RunCLIServer> {
	const readyPath = join(invocation.root, `ready-${randomUUID()}.json`);
	const environment = {
		...process.env,
		[wasmtimeReadyFileEnvironmentVariable]: readyPath,
	};
	const child = spawnWasmtimeCLI(commandArgs, {
		cwd: process.cwd(),
		env: environment,
		stdio: 'inherit',
	});

	let manifest: WasmtimeReadyManifest;
	try {
		manifest = await waitForWasmtimeReady(child, readyPath);
	} catch (error) {
		await terminateChild(child);
		await invocation.cleanup();
		throw error;
	}

	let disposePromise: Promise<void> | undefined;
	const dispose = () => {
		if (!disposePromise) {
			disposePromise = (async () => {
				await terminateChild(child);
				await invocation.cleanup();
			})();
		}
		return disposePromise;
	};
	const serverHandle = new WasmtimeServerHandle(manifest.serverUrl, dispose);
	child.once('close', () => {
		serverHandle.emitClose();
		void invocation.cleanup();
	});

	const playground = createWasmtimePlayground({
		serverUrl: manifest.serverUrl,
		mounts: manifest.mounts,
		assertActive: () => {
			if (
				disposePromise ||
				child.exitCode !== null ||
				child.signalCode !== null
			) {
				throw new Error(
					'The Wasmtime WordPress Playground server is no longer running.'
				);
			}
		},
		executePHPCLI: (argv, phpEnvironment) =>
			executeWasmtimePHPCLI(invocation, argv, phpEnvironment),
	});

	return {
		playground,
		server: serverHandle as unknown as Server,
		serverUrl: manifest.serverUrl,
		[Symbol.asyncDispose]: dispose,
		[internalsKeyForTesting]: {
			workerThreadCount: resolveWorkerCount(invocation.args.workers),
		},
	};
}

async function executeWasmtimePHPCLI(
	invocation: PreparedWasmtimeInvocation,
	argv: string[],
	phpEnvironment?: Record<string, string>
): Promise<WasmtimePHPCLIResult> {
	const phpArgs = wasmtimeArgsFor(invocation, 'php', argv);
	const child = spawnWasmtimeCLI(phpArgs, {
		cwd: process.cwd(),
		env: { ...process.env, ...phpEnvironment },
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	const [stdout, stderr, result] = await Promise.all([
		readChildStream(child.stdout),
		readChildStream(child.stderr),
		waitForChildResult(child),
	]);
	return {
		exitCode: result.code ?? 1,
		stdout,
		stderr: new TextDecoder().decode(stderr),
	};
}

function wasmtimeArgsFor(
	invocation: PreparedWasmtimeInvocation,
	command: RunCLIArgs['command'],
	phpArgs: string[] = []
): string[] {
	const args = invocation.args;
	const wasmtimeArgs: string[] = [command];
	appendValue(wasmtimeArgs, 'php', args.php);
	appendValue(wasmtimeArgs, 'wp', args.wp);
	appendValue(wasmtimeArgs, 'port', args.port);
	appendValue(wasmtimeArgs, 'site-url', args['site-url']);

	for (const mount of invocation.mountsBeforeInstall) {
		wasmtimeArgs.push(
			'--mount-dir-before-install',
			mount.hostPath,
			mount.vfsPath
		);
	}
	for (const mount of invocation.mounts) {
		wasmtimeArgs.push('--mount-dir', mount.hostPath, mount.vfsPath);
	}

	if (command === 'start') {
		appendValue(wasmtimeArgs, 'path', args.path);
		if (args.reset) {
			wasmtimeArgs.push('--reset');
		}
		if (args.skipBrowser) {
			wasmtimeArgs.push('--skip-browser');
		}
	}
	if (command === 'start' || command === 'server') {
		appendValue(wasmtimeArgs, 'workers', args.workers);
	}

	if (args.autoMount === false) {
		wasmtimeArgs.push('--no-auto-mount');
	} else if (typeof args.autoMount === 'string') {
		if (args.autoMount) {
			wasmtimeArgs.push('--auto-mount', args.autoMount);
		} else {
			wasmtimeArgs.push('--auto-mount');
		}
	}
	if (args.login === true) {
		wasmtimeArgs.push('--login');
	} else if (args.login === false) {
		wasmtimeArgs.push('--no-login');
	}
	if (args.wordpressInstallMode) {
		appendValue(
			wasmtimeArgs,
			'wordpress-install-mode',
			args.wordpressInstallMode
		);
	}
	if (args.skipSqliteSetup) {
		wasmtimeArgs.push('--skip-sqlite-setup');
	}
	if (args.blueprint) {
		appendValue(
			wasmtimeArgs,
			'blueprint',
			typeof args.blueprint === 'string'
				? args.blueprint
				: invocation.blueprintPath
		);
	}
	if (args['blueprint-may-read-adjacent-files']) {
		wasmtimeArgs.push('--blueprint-may-read-adjacent-files');
	}
	if (command === 'build-snapshot') {
		appendValue(wasmtimeArgs, 'outfile', args.outfile);
	}
	if (args.quiet) {
		wasmtimeArgs.push('--quiet');
	} else {
		appendValue(wasmtimeArgs, 'verbosity', args.verbosity);
	}
	if (args.debug) {
		wasmtimeArgs.push('--debug');
	}
	if (args.followSymlinks) {
		wasmtimeArgs.push('--follow-symlinks');
	}
	if (args.intl === false) {
		wasmtimeArgs.push('--no-intl');
	}
	if (args.redis) {
		wasmtimeArgs.push('--redis');
	}
	if (args.memcached) {
		wasmtimeArgs.push('--memcached');
	}
	if (args.xdebug === true) {
		wasmtimeArgs.push('--xdebug');
	}

	appendDefinedConstants(wasmtimeArgs, 'define', args.define);
	appendDefinedConstants(wasmtimeArgs, 'define-bool', args['define-bool']);
	appendDefinedConstants(
		wasmtimeArgs,
		'define-number',
		args['define-number']
	);

	if (command === 'php') {
		const positional = phpArgs.length
			? phpArgs
			: dropLeadingCommand(args._ ?? [], 'php');
		if (positional.length) {
			wasmtimeArgs.push('--', ...positional);
		}
	} else if (command === 'run-blueprint' && !args.blueprint) {
		const positional = dropLeadingCommand(args._ ?? [], 'run-blueprint');
		wasmtimeArgs.push(...positional);
	}

	return wasmtimeArgs;
}

function dropLeadingCommand(tokens: string[], command: string): string[] {
	return tokens[0] === command ? tokens.slice(1) : tokens;
}

function appendValue(
	args: string[],
	name: string,
	value: string | number | undefined
) {
	if (value !== undefined) {
		args.push(`--${name}=${value}`);
	}
}

function appendDefinedConstants(
	args: string[],
	name: string,
	values: Record<string, string | number | boolean> | undefined
) {
	for (const [constant, value] of Object.entries(values ?? {})) {
		args.push(`--${name}`, constant, String(value));
	}
}

function normalizeMounts(mounts: Mount[]): WasmtimeVfsMount[] {
	return mounts.map((mount) => {
		if (
			!mount ||
			typeof mount.hostPath !== 'string' ||
			typeof mount.vfsPath !== 'string'
		) {
			throw new Error(
				'Wasmtime runCLI() mounts require hostPath and vfsPath strings.'
			);
		}
		const vfsPath = normalizeVfsMountPath(mount.vfsPath);
		return {
			hostPath: resolve(mount.hostPath),
			vfsPath,
		};
	});
}

function normalizeVfsMountPath(path: string): string {
	if (!path.startsWith('/')) {
		throw new Error(
			`Wasmtime runCLI() mount paths must be absolute: ${path}.`
		);
	}
	return posix.normalize(path);
}

function assertSupportedProgrammaticOptions(args: RunCLIArgs) {
	const unsupported: Array<[string, unknown]> = [
		['pathAliases', args.pathAliases?.length],
		[
			'additional-blueprint-steps',
			args['additional-blueprint-steps']?.length,
		],
		['phpmyadmin', args.phpmyadmin],
		['phpExtension', args.phpExtension?.length],
		[
			'experimentalUnsafeIdeIntegration',
			args.experimentalUnsafeIdeIntegration?.length,
		],
		['experimentalDevtools', args.experimentalDevtools],
		[
			'experimental-blueprints-v2-runner',
			args['experimental-blueprints-v2-runner'],
		],
		['experimental-multi-worker', args['experimental-multi-worker']],
		['experimentalTrace', args.experimentalTrace],
		['internalCookieStore', args.internalCookieStore],
		['mode', args.mode],
		['db-engine', args['db-engine']],
		['db-host', args['db-host']],
		['db-user', args['db-user']],
		['db-pass', args['db-pass']],
		['db-name', args['db-name']],
		['db-path', args['db-path']],
		['truncate-new-site-directory', args['truncate-new-site-directory']],
		['allow', args.allow],
	];
	const option = unsupported.find(([, value]) => Boolean(value))?.[0];
	if (option) {
		throw new Error(
			`The Wasmtime runCLI() adapter does not support ${option} yet. Use a Wasmtime-compatible CLI option instead.`
		);
	}
	if (args.xdebug && args.xdebug !== true) {
		throw new Error(
			'The Wasmtime runCLI() adapter supports xdebug: true, but not Node Xdebug configuration objects.'
		);
	}
}

async function waitForWasmtimeReady(
	child: ChildProcess,
	readyPath: string
): Promise<WasmtimeReadyManifest> {
	let processFailure: Error | undefined;
	const onError = (error: Error) => {
		processFailure = error;
	};
	const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
		processFailure = new Error(
			`The Wasmtime host exited before it became ready (code ${code ?? 'none'}, signal ${signal ?? 'none'}).`
		);
	};
	child.once('error', onError);
	child.once('close', onClose);

	try {
		const deadline = Date.now() + wasmtimeStartupTimeoutMilliseconds;
		while (Date.now() < deadline) {
			if (processFailure) {
				throw processFailure;
			}
			try {
				const manifest = parseWasmtimeReadyManifest(
					JSON.parse(await readFile(readyPath, 'utf8'))
				);
				return manifest;
			} catch (error) {
				if (
					!(error instanceof SyntaxError) &&
					!isErrorWithCode(error, 'ENOENT')
				) {
					throw error;
				}
			}
			await wait(20);
		}
		throw new Error(
			`Timed out waiting for Wasmtime host readiness after ${wasmtimeStartupTimeoutMilliseconds}ms.`
		);
	} finally {
		child.off('error', onError);
		child.off('close', onClose);
	}
}

function parseWasmtimeReadyManifest(value: unknown): WasmtimeReadyManifest {
	if (!value || typeof value !== 'object') {
		throw new Error(
			'The Wasmtime host wrote an invalid readiness manifest.'
		);
	}
	const manifest = value as Partial<WasmtimeReadyManifest>;
	if (manifest.protocolVersion !== wasmtimeReadyProtocolVersion) {
		throw new Error(
			`Wasmtime host readiness protocol ${manifest.protocolVersion} is not supported.`
		);
	}
	if (
		typeof manifest.serverUrl !== 'string' ||
		typeof manifest.siteUrl !== 'string'
	) {
		throw new Error(
			'The Wasmtime host readiness manifest is missing server URLs.'
		);
	}
	const serverUrl = new URL(manifest.serverUrl);
	if (serverUrl.protocol !== 'http:' || serverUrl.hostname !== '127.0.0.1') {
		throw new Error(
			`The Wasmtime host readiness endpoint must be loopback HTTP, got ${manifest.serverUrl}.`
		);
	}
	if (!Array.isArray(manifest.mounts)) {
		throw new Error(
			'The Wasmtime host readiness manifest is missing mounts.'
		);
	}
	const mounts = manifest.mounts.map((mount) => {
		if (
			!mount ||
			typeof mount.hostPath !== 'string' ||
			typeof mount.vfsPath !== 'string'
		) {
			throw new Error(
				'The Wasmtime host readiness manifest has an invalid mount.'
			);
		}
		return {
			hostPath: resolve(mount.hostPath),
			vfsPath: normalizeVfsMountPath(mount.vfsPath),
		};
	});
	return {
		protocolVersion: manifest.protocolVersion,
		serverUrl: manifest.serverUrl,
		siteUrl: manifest.siteUrl,
		pid: typeof manifest.pid === 'number' ? manifest.pid : 0,
		mounts,
	};
}

async function terminateChild(child: ChildProcess): Promise<void> {
	if (child.exitCode !== null || child.signalCode !== null) {
		return;
	}
	child.kill('SIGTERM');
	if (await waitForChildExit(child, wasmtimeShutdownTimeoutMilliseconds)) {
		return;
	}
	child.kill('SIGKILL');
	await waitForChildExit(child, wasmtimeShutdownTimeoutMilliseconds);
}

async function waitForChildExit(
	child: ChildProcess,
	timeoutMilliseconds = wasmtimeShutdownTimeoutMilliseconds
): Promise<boolean> {
	if (child.exitCode !== null || child.signalCode !== null) {
		return true;
	}
	return await new Promise<boolean>((resolvePromise) => {
		let settled = false;
		const settle = (didExit: boolean) => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timeout);
			child.off('close', onClose);
			child.off('error', onError);
			resolvePromise(didExit);
		};
		const timeout = setTimeout(() => settle(false), timeoutMilliseconds);
		const onClose = () => settle(true);
		const onError = () => settle(true);
		child.once('close', onClose);
		child.once('error', onError);
	});
}

async function waitForChildResult(
	child: ChildProcess
): Promise<WasmtimeCLIExit> {
	if (child.exitCode !== null || child.signalCode !== null) {
		return { code: child.exitCode, signal: child.signalCode };
	}
	return await new Promise<WasmtimeCLIExit>((resolvePromise) => {
		const onClose = (
			code: number | null,
			signal: NodeJS.Signals | null
		) => {
			child.off('error', onError);
			resolvePromise({ code, signal });
		};
		const onError = () => {
			child.off('close', onClose);
			resolvePromise({ code: child.exitCode, signal: child.signalCode });
		};
		child.once('close', onClose);
		child.once('error', onError);
	});
}

async function readChildStream(
	stream: NodeJS.ReadableStream | null
): Promise<Uint8Array> {
	if (!stream) {
		return new Uint8Array();
	}
	const chunks: Uint8Array[] = [];
	for await (const chunk of stream) {
		chunks.push(
			typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk
		);
	}
	const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
	const result = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return result;
}

function ensureWasmtimeCommandSucceeded(
	result: WasmtimeCLIExit,
	command: string
) {
	if (result.signal) {
		throw new Error(
			`The Wasmtime host ${command} command stopped with ${result.signal}.`
		);
	}
	if (result.code !== 0) {
		throw new Error(
			`The Wasmtime host ${command} command exited with code ${result.code ?? 'none'}.`
		);
	}
}

function isErrorWithCode(error: unknown, code: string): boolean {
	return (
		error instanceof Error &&
		'code' in error &&
		(error as NodeJS.ErrnoException).code === code
	);
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolvePromise) =>
		setTimeout(resolvePromise, milliseconds)
	);
}

class WasmtimeServerHandle extends EventEmitter {
	#closed = false;
	private readonly serverUrl: string;
	private readonly dispose: () => Promise<void>;

	constructor(serverUrl: string, dispose: () => Promise<void>) {
		super();
		this.serverUrl = serverUrl;
		this.dispose = dispose;
	}

	close(callback?: (error?: Error) => void): this {
		void this.dispose().then(
			() => callback?.(),
			(error) => callback?.(error as Error)
		);
		return this;
	}

	closeAllConnections() {
		void this.dispose();
	}

	address(): AddressInfo {
		const url = new URL(this.serverUrl);
		return {
			address: url.hostname,
			family: url.hostname.includes(':') ? 'IPv6' : 'IPv4',
			port: Number(url.port),
		};
	}

	emitClose() {
		if (!this.#closed) {
			this.#closed = true;
			this.emit('close');
		}
	}
}

export type { PlaygroundCliWorker, RunCLIArgs } from './run-cli';
