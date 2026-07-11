import {
	spawn,
	type ChildProcess,
	type StdioOptions,
} from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Environment variable for a locally built or otherwise custom Wasmtime host. */
export const wasmtimeBinaryEnvironmentVariable =
	'WP_PLAYGROUND_WASMTIME_BINARY';

export type WasmtimeCLIExit = {
	code: number | null;
	signal: NodeJS.Signals | null;
};

export type WasmtimeBinaryResolutionOptions = {
	environment?: NodeJS.ProcessEnv;
	moduleDirectory?: string;
	platform?: NodeJS.Platform;
	arch?: string;
};

export type SpawnWasmtimeCLIOptions = {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	stdio?: StdioOptions;
	resolution?: WasmtimeBinaryResolutionOptions;
};

export type RunWasmtimeCLIOptions = SpawnWasmtimeCLIOptions & {
	forwardSignals?: boolean;
};

/**
 * Resolves the executable name used by a Wasmtime package on this platform.
 */
export function wasmtimeBinaryFileName(platform = process.platform): string {
	return platform === 'win32'
		? 'wp-playground-native.exe'
		: 'wp-playground-native';
}

/**
 * Names the package directory containing the current platform's Wasmtime host.
 */
export function wasmtimeBinaryTarget(
	platform: NodeJS.Platform = process.platform,
	arch: string = process.arch
): string {
	const packagePlatform =
		platform === 'darwin'
			? 'macos'
			: platform === 'win32'
				? 'windows'
				: platform;
	return `${packagePlatform}-${arch}`;
}

/** Names the optional npm package that provides this platform's Wasmtime host. */
export function wasmtimeBinaryPackageName(
	platform: NodeJS.Platform = process.platform,
	arch: string = process.arch
): string {
	return `@wp-playground/cli-wasmtime-${wasmtimeBinaryTarget(platform, arch)}`;
}

/**
 * Locates the Wasmtime host without substituting the legacy JavaScript runtime.
 *
 * Published packages install the matching host as an optional platform package.
 * A colocated `wasmtime/` directory remains supported for self-contained bundles.
 * Developers may set `WP_PLAYGROUND_WASMTIME_BINARY` to a locally built host.
 */
export function resolveWasmtimeBinary(
	options: WasmtimeBinaryResolutionOptions = {}
): string {
	const environment = options.environment ?? process.env;
	const configured = environment[wasmtimeBinaryEnvironmentVariable];
	if (configured) {
		return resolveConfiguredBinary(configured);
	}

	const moduleDirectory =
		options.moduleDirectory ?? dirname(fileURLToPath(import.meta.url));
	const platform = options.platform ?? process.platform;
	const arch = options.arch ?? process.arch;
	const binaryName = wasmtimeBinaryFileName(platform);
	const bundledCandidates = [
		join(
			moduleDirectory,
			'wasmtime',
			wasmtimeBinaryTarget(platform, arch),
			binaryName
		),
		join(moduleDirectory, 'wasmtime', binaryName),
	];
	const bundledBinary = bundledCandidates.find(existsSync);
	if (bundledBinary) {
		return bundledBinary;
	}

	const wasmtimePackageBinary = resolveWasmtimePackageBinary(
		moduleDirectory,
		platform,
		arch
	);
	if (wasmtimePackageBinary) {
		return wasmtimePackageBinary;
	}

	const sourceCandidates = [
		join(
			moduleDirectory,
			'..',
			'..',
			'cli-native',
			'target',
			'release',
			binaryName
		),
		join(
			moduleDirectory,
			'..',
			'..',
			'cli-native',
			'target',
			'debug',
			binaryName
		),
	];
	const binary = sourceCandidates.find(existsSync);
	if (binary) {
		return binary;
	}

	throw new Error(
		`Could not find the Wasmtime WordPress Playground host for ${wasmtimeBinaryTarget(
			platform,
			arch
		)}. Set ${wasmtimeBinaryEnvironmentVariable} to a Wasmtime host executable or install ${wasmtimeBinaryPackageName(
			platform,
			arch
		)}. Checked:\n${[...bundledCandidates, ...sourceCandidates]
			.map((candidate) => `  ${candidate}`)
			.join('\n')}`
	);
}

function resolveWasmtimePackageBinary(
	moduleDirectory: string,
	platform: NodeJS.Platform,
	arch: string
): string | undefined {
	const packageName = wasmtimeBinaryPackageName(platform, arch);
	let packageJson: string;
	try {
		packageJson = createRequire(
			join(moduleDirectory, 'package.json')
		).resolve(`${packageName}/package.json`);
	} catch (error) {
		if (isModuleNotFound(error)) {
			return undefined;
		}
		throw error;
	}

	const binary = join(
		dirname(packageJson),
		'bin',
		wasmtimeBinaryFileName(platform)
	);
	if (!existsSync(binary)) {
		throw new Error(
			`${packageName} is installed but does not contain ${binary}. Reinstall the package or set ${wasmtimeBinaryEnvironmentVariable}.`
		);
	}
	return binary;
}

/** Starts the Wasmtime host with a resolved executable and no shell interpolation. */
export function spawnWasmtimeCLI(
	args: string[],
	options: SpawnWasmtimeCLIOptions = {}
): ChildProcess {
	const binary = resolveWasmtimeBinary({
		...options.resolution,
		environment: options.resolution?.environment ?? options.env,
	});
	return spawn(binary, args, {
		cwd: options.cwd,
		env: options.env,
		stdio: options.stdio ?? 'inherit',
	});
}

/**
 * Runs one Wasmtime CLI command and reports its natural process outcome.
 *
 * Signal forwarding is opt-in because an embedding application owns its own
 * lifecycle; the executable entry point enables it for terminal use.
 */
export async function runWasmtimeCLI(
	args: string[],
	options: RunWasmtimeCLIOptions = {}
): Promise<WasmtimeCLIExit> {
	const child = spawnWasmtimeCLI(args, options);
	const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
	const forwardSignal = (signal: NodeJS.Signals) => {
		if (!child.killed) {
			child.kill(signal);
		}
	};

	if (options.forwardSignals) {
		for (const signal of signals) {
			process.on(signal, forwardSignal);
		}
	}

	return await new Promise<WasmtimeCLIExit>((resolvePromise, reject) => {
		let settled = false;
		const cleanup = () => {
			if (options.forwardSignals) {
				for (const signal of signals) {
					process.off(signal, forwardSignal);
				}
			}
		};
		const settle = (callback: () => void) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			callback();
		};

		child.once('error', (error) => settle(() => reject(error)));
		child.once('close', (code, signal) =>
			settle(() => resolvePromise({ code, signal }))
		);
	});
}

function resolveConfiguredBinary(configured: string): string {
	if (!looksLikePath(configured)) {
		return configured;
	}

	const binary = resolve(configured);
	if (!existsSync(binary)) {
		throw new Error(
			`${wasmtimeBinaryEnvironmentVariable} points to a missing executable: ${binary}`
		);
	}
	return binary;
}

function looksLikePath(value: string): boolean {
	return (
		isAbsolute(value) ||
		value.startsWith('.') ||
		value.includes(sep) ||
		value.includes('/') ||
		value.includes('\\')
	);
}

function isModuleNotFound(error: unknown): boolean {
	return (
		error instanceof Error &&
		'code' in error &&
		(error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND'
	);
}
