import {
	spawn,
	type ChildProcess,
	type SpawnOptions,
} from 'node:child_process';
import { ensureNativeHost, type EnsureNativeHostOptions } from './host.js';

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

export function waitForChild(child: ChildProcess): Promise<NativeCLIResult> {
	return new Promise((resolvePromise, reject) => {
		const forward = (signal: NodeJS.Signals) => child.kill(signal);
		const onSigint = () => forward('SIGINT');
		const onSigterm = () => forward('SIGTERM');
		const cleanup = () => {
			process.off('SIGINT', onSigint);
			process.off('SIGTERM', onSigterm);
		};
		process.on('SIGINT', onSigint);
		process.on('SIGTERM', onSigterm);
		child.once('error', (error) => {
			cleanup();
			reject(error);
		});
		child.once('close', (code, signal) => {
			cleanup();
			resolvePromise({ code, signal });
		});
	});
}
