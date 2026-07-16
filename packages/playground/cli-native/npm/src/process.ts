import {
	spawn,
	type ChildProcess,
	type SpawnOptions,
} from 'node:child_process';
import type { Readable } from 'node:stream';
import { TextDecoder } from 'node:util';
import { NativeCLIError, NativeCLIErrorCode } from './errors.js';
import { ensureNativeHost, type EnsureNativeHostOptions } from './host.js';

const ARGV_PROBE_FLAG = '--experimental-parse-argv-json';
const MAX_ARGV_PROBE_STDOUT_BYTES = 16 * 1024;
const MAX_ARGV_PROBE_STDERR_BYTES = 4 * 1024;

export type NativeCLIArgvProbeCommand =
	| 'start'
	| 'server'
	| 'run-blueprint'
	| 'build-snapshot';

export type NativeCLIArgvProbeValidResult = {
	[Command in NativeCLIArgvProbeCommand]: {
		status: 'valid';
		command: Command;
		port: number | null;
		siteUrl: string | null;
	};
}[NativeCLIArgvProbeCommand];

export type NativeCLIArgvProbeResult =
	| NativeCLIArgvProbeValidResult
	| { status: 'invalid'; exitCode: 1; message: string };

export interface ParseNativeCLIArgsOptions {
	cwd?: string;
}

export interface SpawnNativeCLIOptions extends EnsureNativeHostOptions {
	argv: string[];
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	stdio?: SpawnOptions['stdio'];
}

export async function spawnNativeCLI(
	options: SpawnNativeCLIOptions
): Promise<ChildProcess> {
	const installation = await ensureNativeHost(options);
	return spawn(installation.executablePath, options.argv, {
		cwd: options.cwd,
		env: {
			...process.env,
			...options.env,
			WP_PLAYGROUND_NATIVE_ASSET_ROOT: installation.assetRoot,
			WP_PLAYGROUND_NATIVE_DISABLE_SOURCE_FALLBACK: '1',
		},
		stdio: options.stdio ?? 'inherit',
		windowsHide: true,
	});
}

export interface NativeCLIResult {
	code: number | null;
	signal: NodeJS.Signals | null;
}

export async function runNativeCLI(
	options: SpawnNativeCLIOptions
): Promise<NativeCLIResult> {
	const child = await spawnNativeCLI(options);
	return await waitForChild(child);
}

/**
 * Ask the native executable to parse argv without loading PHP or WordPress.
 * Unsupported-option preflight remains the public API layer's responsibility.
 */
export async function parseNativeCLIArgs(
	argv: string[],
	options: ParseNativeCLIArgsOptions = {}
): Promise<NativeCLIArgvProbeResult> {
	let child: ChildProcess;
	try {
		child = await spawnNativeCLI({
			argv: [ARGV_PROBE_FLAG, ...argv],
			cwd: options.cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
	} catch (cause) {
		if (cause instanceof NativeCLIError) throw cause;
		throw argvProbeSpawnError(
			'Could not spawn the native argv parser.',
			cause
		);
	}

	if (!child.stdout || !child.stderr) {
		killProbeChild(child);
		throw argvProbeProtocolError(
			'The native argv parser did not expose its output pipes.'
		);
	}

	const stdout = collectBoundedOutput(
		child.stdout,
		MAX_ARGV_PROBE_STDOUT_BYTES,
		() => killProbeChild(child)
	);
	const stderr = collectBoundedOutput(
		child.stderr,
		MAX_ARGV_PROBE_STDERR_BYTES,
		() => killProbeChild(child)
	);

	let processResult: NativeCLIResult;
	try {
		processResult = await waitForChild(child);
	} catch (cause) {
		throw argvProbeSpawnError(
			'The native argv parser could not run.',
			cause
		);
	} finally {
		stdout.dispose();
		stderr.dispose();
	}

	const outputSummary = summarizeCapturedOutput(stdout, stderr);
	if (stdout.overflowed || stderr.overflowed) {
		throw argvProbeProtocolError(
			`The native argv parser exceeded its output limit (${outputSummary}).`
		);
	}
	if (stdout.failed || stderr.failed) {
		throw argvProbeProtocolError(
			`A native argv parser output stream failed (${outputSummary}).`
		);
	}
	if (processResult.signal !== null) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Spawn,
			`The native argv parser terminated with ${processResult.signal} (${outputSummary}).`,
			{ details: { signal: processResult.signal } }
		);
	}
	if (processResult.code !== 0) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Spawn,
			`The native argv parser exited with code ${String(processResult.code)} (${outputSummary}).`,
			{
				details:
					typeof processResult.code === 'number'
						? { exitCode: processResult.code }
						: undefined,
			}
		);
	}
	if (stderr.bytesSeen !== 0) {
		throw argvProbeProtocolError(
			`The native argv parser returned unexpected stderr (${outputSummary}).`
		);
	}

	let value: unknown;
	try {
		value = JSON.parse(stdout.text());
	} catch {
		throw argvProbeProtocolError(
			`The native argv parser returned malformed JSON (${outputSummary}).`
		);
	}
	const parsed = validateArgvProbeResult(value, outputSummary);
	if (parsed.status === 'valid' && parsed.command !== argv[0]) {
		throw argvProbeProtocolError(
			`The native argv parser returned a command that did not match its request (${outputSummary}).`
		);
	}
	return parsed;
}

export function waitForChild(child: ChildProcess): Promise<NativeCLIResult> {
	return new Promise((resolvePromise, reject) => {
		const forward = (signal: NodeJS.Signals) => child.kill(signal);
		const onSigint = () => forward('SIGINT');
		const onSigterm = () => forward('SIGTERM');
		const cleanup = () => {
			process.off('SIGINT', onSigint);
			process.off('SIGTERM', onSigterm);
			child.off('error', onError);
			child.off('close', onClose);
		};
		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};
		const onClose = (
			code: number | null,
			signal: NodeJS.Signals | null
		) => {
			cleanup();
			resolvePromise({ code, signal });
		};
		process.on('SIGINT', onSigint);
		process.on('SIGTERM', onSigterm);
		child.once('error', onError);
		child.once('close', onClose);
	});
}

interface BoundedOutput {
	readonly bytesSeen: number;
	readonly overflowed: boolean;
	readonly failed: boolean;
	text(): string;
	dispose(): void;
}

function collectBoundedOutput(
	stream: Readable,
	limit: number,
	onOverflow: () => void
): BoundedOutput {
	const chunks: Buffer[] = [];
	let bytesSeen = 0;
	let overflowed = false;
	let failed = false;
	const onData = (chunk: Buffer | string) => {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		bytesSeen = Math.min(
			Number.MAX_SAFE_INTEGER,
			bytesSeen + buffer.byteLength
		);
		if (overflowed) return;
		if (bytesSeen > limit) {
			overflowed = true;
			chunks.length = 0;
			onOverflow();
			return;
		}
		chunks.push(buffer);
	};
	const onError = () => {
		failed = true;
		chunks.length = 0;
		onOverflow();
	};
	stream.on('data', onData);
	stream.on('error', onError);
	return {
		get bytesSeen() {
			return bytesSeen;
		},
		get overflowed() {
			return overflowed;
		},
		get failed() {
			return failed;
		},
		text: () =>
			new TextDecoder('utf-8', { fatal: true }).decode(
				Buffer.concat(chunks)
			),
		dispose: () => {
			stream.off('data', onData);
			stream.off('error', onError);
		},
	};
}

function validateArgvProbeResult(
	value: unknown,
	outputSummary: string
): NativeCLIArgvProbeResult {
	if (!isPlainRecord(value) || value['schemaVersion'] !== 1) {
		throw invalidArgvProbeSchema(outputSummary);
	}
	if (value['status'] === 'valid') {
		if (
			!hasExactKeys(value, [
				'schemaVersion',
				'status',
				'command',
				'port',
				'siteUrl',
			]) ||
			!isArgvProbeCommand(value['command']) ||
			!isPortOrNull(value['port']) ||
			!isStringOrNull(value['siteUrl'])
		) {
			throw invalidArgvProbeSchema(outputSummary);
		}
		return validArgvProbeResult(
			value['command'],
			value['port'],
			value['siteUrl']
		);
	}
	if (
		value['status'] === 'invalid' &&
		hasExactKeys(value, [
			'schemaVersion',
			'status',
			'exitCode',
			'message',
		]) &&
		value['exitCode'] === 1 &&
		typeof value['message'] === 'string' &&
		value['message'].length > 0
	) {
		return {
			status: 'invalid',
			exitCode: 1,
			message: value['message'],
		};
	}
	throw invalidArgvProbeSchema(outputSummary);
}

function validArgvProbeResult(
	command: NativeCLIArgvProbeCommand,
	port: number | null,
	siteUrl: string | null
): NativeCLIArgvProbeValidResult {
	const common = { status: 'valid' as const, port, siteUrl };
	switch (command) {
		case 'start':
			return { ...common, command };
		case 'server':
			return { ...common, command };
		case 'run-blueprint':
			return { ...common, command };
		case 'build-snapshot':
			return { ...common, command };
	}
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		Object.getPrototypeOf(value) === Object.prototype
	);
}

function hasExactKeys(
	value: Record<string, unknown>,
	expected: readonly string[]
): boolean {
	const keys = Object.keys(value).sort();
	const expectedKeys = [...expected].sort();
	return (
		keys.length === expectedKeys.length &&
		keys.every((key, index) => key === expectedKeys[index])
	);
}

function isArgvProbeCommand(
	value: unknown
): value is NativeCLIArgvProbeCommand {
	return (
		typeof value === 'string' &&
		['start', 'server', 'run-blueprint', 'build-snapshot'].includes(value)
	);
}

function isPortOrNull(value: unknown): value is number | null {
	return (
		value === null ||
		(typeof value === 'number' &&
			Number.isInteger(value) &&
			value >= 0 &&
			value <= 65_535)
	);
}

function isStringOrNull(value: unknown): value is string | null {
	return value === null || typeof value === 'string';
}

function invalidArgvProbeSchema(outputSummary: string): NativeCLIError {
	return argvProbeProtocolError(
		`The native argv parser returned an invalid schema (${outputSummary}).`
	);
}

function argvProbeProtocolError(message: string): NativeCLIError {
	return new NativeCLIError(NativeCLIErrorCode.Protocol, message);
}

function argvProbeSpawnError(message: string, cause: unknown): NativeCLIError {
	return new NativeCLIError(NativeCLIErrorCode.Spawn, message, { cause });
}

function killProbeChild(child: ChildProcess): void {
	try {
		child.kill();
	} catch {
		// The original protocol or stream error remains the actionable failure.
	}
}

function summarizeCapturedOutput(
	stdout: Pick<BoundedOutput, 'bytesSeen'>,
	stderr: Pick<BoundedOutput, 'bytesSeen'>
): string {
	return `stdout ${stdout.bytesSeen} bytes, stderr ${stderr.bytesSeen} bytes; contents redacted`;
}
