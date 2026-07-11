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
	runNativeCLI,
	spawnNativeCLI,
	type NativeCLIExit,
} from './native-binary';
import {
	createNativePlayground,
	type NativePHPCLIResult,
	type NativeVfsMount,
} from './native-playground';

const nativeReadyFileEnvironmentVariable = 'WP_PLAYGROUND_NATIVE_READY_FILE';
const nativeReadyProtocolVersion = 2;
const nativeStartupTimeoutMilliseconds = 120_000;
const nativeShutdownTimeoutMilliseconds = 5_000;
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

type NativeReadyManifest = {
	protocolVersion: number;
	serverUrl: string;
	siteUrl: string;
	pid: number;
	mounts: NativeVfsMount[];
};

type PreparedNativeInvocation = {
	args: RunCLIArgs;
	root: string;
	mountsBeforeInstall: NativeVfsMount[];
	mounts: NativeVfsMount[];
	blueprintPath?: string;
	cleanup: () => Promise<void>;
};

/**
 * Resolves the native host worker count using the long-standing CLI policy.
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
	const result = await runNativeCLI(argsToParse, { stdio: 'inherit' });
	ensureNativeCommandSucceeded(result, argsToParse[0] ?? 'wp-playground-cli');
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
	const invocation = await prepareNativeInvocation(args);
	const commandArgs = nativeArgsFor(invocation, args.command);

	if (args.command !== 'server' && args.command !== 'start') {
		try {
			const result = await runNativeCLI(commandArgs, {
				stdio: 'inherit',
			});
			ensureNativeCommandSucceeded(result, args.command);
		} finally {
			await invocation.cleanup();
		}
		return;
	}

	return await startNativeServer(invocation, commandArgs);
}

async function prepareNativeInvocation(
	args: RunCLIArgs
): Promise<PreparedNativeInvocation> {
	const root = await mkdtemp(join(tmpdir(), 'wp-playground-native-api-'));
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
		const wrapperMounts: NativeVfsMount[] = [];

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
					'Native runCLI() could not serialize the Blueprint input.'
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

async function startNativeServer(
	invocation: PreparedNativeInvocation,
	commandArgs: string[]
): Promise<RunCLIServer> {
	const readyPath = join(invocation.root, `ready-${randomUUID()}.json`);
	const environment = {
		...process.env,
		[nativeReadyFileEnvironmentVariable]: readyPath,
	};
	const child = spawnNativeCLI(commandArgs, {
		cwd: process.cwd(),
		env: environment,
		stdio: 'inherit',
	});

	let manifest: NativeReadyManifest;
	try {
		manifest = await waitForNativeReady(child, readyPath);
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
	const serverHandle = new NativeServerHandle(manifest.serverUrl, dispose);
	child.once('close', () => {
		serverHandle.emitClose();
		void invocation.cleanup();
	});

	const playground = createNativePlayground({
		serverUrl: manifest.serverUrl,
		mounts: manifest.mounts,
		assertActive: () => {
			if (
				disposePromise ||
				child.exitCode !== null ||
				child.signalCode !== null
			) {
				throw new Error(
					'The native WordPress Playground server is no longer running.'
				);
			}
		},
		executePHPCLI: (argv, phpEnvironment) =>
			executeNativePHPCLI(invocation, argv, phpEnvironment),
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

async function executeNativePHPCLI(
	invocation: PreparedNativeInvocation,
	argv: string[],
	phpEnvironment?: Record<string, string>
): Promise<NativePHPCLIResult> {
	const phpArgs = nativeArgsFor(invocation, 'php', argv);
	const child = spawnNativeCLI(phpArgs, {
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

function nativeArgsFor(
	invocation: PreparedNativeInvocation,
	command: RunCLIArgs['command'],
	phpArgs: string[] = []
): string[] {
	const args = invocation.args;
	const nativeArgs: string[] = [command];
	appendValue(nativeArgs, 'php', args.php);
	appendValue(nativeArgs, 'wp', args.wp);
	appendValue(nativeArgs, 'port', args.port);
	appendValue(nativeArgs, 'site-url', args['site-url']);

	for (const mount of invocation.mountsBeforeInstall) {
		nativeArgs.push(
			'--mount-dir-before-install',
			mount.hostPath,
			mount.vfsPath
		);
	}
	for (const mount of invocation.mounts) {
		nativeArgs.push('--mount-dir', mount.hostPath, mount.vfsPath);
	}

	if (command === 'start') {
		appendValue(nativeArgs, 'path', args.path);
		if (args.reset) {
			nativeArgs.push('--reset');
		}
		if (args.skipBrowser) {
			nativeArgs.push('--skip-browser');
		}
	}
	if (command === 'start' || command === 'server') {
		appendValue(nativeArgs, 'workers', args.workers);
	}

	if (args.autoMount === false) {
		nativeArgs.push('--no-auto-mount');
	} else if (typeof args.autoMount === 'string') {
		if (args.autoMount) {
			nativeArgs.push('--auto-mount', args.autoMount);
		} else {
			nativeArgs.push('--auto-mount');
		}
	}
	if (args.login === true) {
		nativeArgs.push('--login');
	} else if (args.login === false) {
		nativeArgs.push('--no-login');
	}
	if (args.wordpressInstallMode) {
		appendValue(
			nativeArgs,
			'wordpress-install-mode',
			args.wordpressInstallMode
		);
	}
	if (args.skipSqliteSetup) {
		nativeArgs.push('--skip-sqlite-setup');
	}
	if (args.blueprint) {
		appendValue(
			nativeArgs,
			'blueprint',
			typeof args.blueprint === 'string'
				? args.blueprint
				: invocation.blueprintPath
		);
	}
	if (args['blueprint-may-read-adjacent-files']) {
		nativeArgs.push('--blueprint-may-read-adjacent-files');
	}
	if (command === 'build-snapshot') {
		appendValue(nativeArgs, 'outfile', args.outfile);
	}
	if (args.quiet) {
		nativeArgs.push('--quiet');
	} else {
		appendValue(nativeArgs, 'verbosity', args.verbosity);
	}
	if (args.debug) {
		nativeArgs.push('--debug');
	}
	if (args.followSymlinks) {
		nativeArgs.push('--follow-symlinks');
	}
	if (args.intl === false) {
		nativeArgs.push('--no-intl');
	}
	if (args.redis) {
		nativeArgs.push('--redis');
	}
	if (args.memcached) {
		nativeArgs.push('--memcached');
	}
	if (args.xdebug === true) {
		nativeArgs.push('--xdebug');
	}

	appendDefinedConstants(nativeArgs, 'define', args.define);
	appendDefinedConstants(nativeArgs, 'define-bool', args['define-bool']);
	appendDefinedConstants(nativeArgs, 'define-number', args['define-number']);

	if (command === 'php') {
		const positional = phpArgs.length
			? phpArgs
			: dropLeadingCommand(args._ ?? [], 'php');
		if (positional.length) {
			nativeArgs.push('--', ...positional);
		}
	} else if (command === 'run-blueprint' && !args.blueprint) {
		const positional = dropLeadingCommand(args._ ?? [], 'run-blueprint');
		nativeArgs.push(...positional);
	}

	return nativeArgs;
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

function normalizeMounts(mounts: Mount[]): NativeVfsMount[] {
	return mounts.map((mount) => {
		if (
			!mount ||
			typeof mount.hostPath !== 'string' ||
			typeof mount.vfsPath !== 'string'
		) {
			throw new Error(
				'Native runCLI() mounts require hostPath and vfsPath strings.'
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
			`Native runCLI() mount paths must be absolute: ${path}.`
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
			`The Wasmtime runCLI() adapter does not support ${option} yet. Use a native v1-compatible CLI option instead.`
		);
	}
	if (args.xdebug && args.xdebug !== true) {
		throw new Error(
			'The Wasmtime runCLI() adapter supports xdebug: true, but not Node Xdebug configuration objects.'
		);
	}
}

async function waitForNativeReady(
	child: ChildProcess,
	readyPath: string
): Promise<NativeReadyManifest> {
	let processFailure: Error | undefined;
	const onError = (error: Error) => {
		processFailure = error;
	};
	const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
		processFailure = new Error(
			`wp-playground-native exited before it became ready (code ${code ?? 'none'}, signal ${signal ?? 'none'}).`
		);
	};
	child.once('error', onError);
	child.once('close', onClose);

	try {
		const deadline = Date.now() + nativeStartupTimeoutMilliseconds;
		while (Date.now() < deadline) {
			if (processFailure) {
				throw processFailure;
			}
			try {
				const manifest = parseNativeReadyManifest(
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
			`Timed out waiting for wp-playground-native readiness after ${nativeStartupTimeoutMilliseconds}ms.`
		);
	} finally {
		child.off('error', onError);
		child.off('close', onClose);
	}
}

function parseNativeReadyManifest(value: unknown): NativeReadyManifest {
	if (!value || typeof value !== 'object') {
		throw new Error(
			'wp-playground-native wrote an invalid readiness manifest.'
		);
	}
	const manifest = value as Partial<NativeReadyManifest>;
	if (manifest.protocolVersion !== nativeReadyProtocolVersion) {
		throw new Error(
			`wp-playground-native readiness protocol ${manifest.protocolVersion} is not supported.`
		);
	}
	if (
		typeof manifest.serverUrl !== 'string' ||
		typeof manifest.siteUrl !== 'string'
	) {
		throw new Error(
			'wp-playground-native readiness manifest is missing server URLs.'
		);
	}
	const serverUrl = new URL(manifest.serverUrl);
	if (serverUrl.protocol !== 'http:' || serverUrl.hostname !== '127.0.0.1') {
		throw new Error(
			`wp-playground-native readiness endpoint must be loopback HTTP, got ${manifest.serverUrl}.`
		);
	}
	if (!Array.isArray(manifest.mounts)) {
		throw new Error(
			'wp-playground-native readiness manifest is missing mounts.'
		);
	}
	const mounts = manifest.mounts.map((mount) => {
		if (
			!mount ||
			typeof mount.hostPath !== 'string' ||
			typeof mount.vfsPath !== 'string'
		) {
			throw new Error(
				'wp-playground-native readiness manifest has an invalid mount.'
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
	if (await waitForChildExit(child, nativeShutdownTimeoutMilliseconds)) {
		return;
	}
	child.kill('SIGKILL');
	await waitForChildExit(child, nativeShutdownTimeoutMilliseconds);
}

async function waitForChildExit(
	child: ChildProcess,
	timeoutMilliseconds = nativeShutdownTimeoutMilliseconds
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

async function waitForChildResult(child: ChildProcess): Promise<NativeCLIExit> {
	if (child.exitCode !== null || child.signalCode !== null) {
		return { code: child.exitCode, signal: child.signalCode };
	}
	return await new Promise<NativeCLIExit>((resolvePromise) => {
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

function ensureNativeCommandSucceeded(result: NativeCLIExit, command: string) {
	if (result.signal) {
		throw new Error(
			`wp-playground-native ${command} stopped with ${result.signal}.`
		);
	}
	if (result.code !== 0) {
		throw new Error(
			`wp-playground-native ${command} exited with code ${result.code ?? 'none'}.`
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

class NativeServerHandle extends EventEmitter {
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
