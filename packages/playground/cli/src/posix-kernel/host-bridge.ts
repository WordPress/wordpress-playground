/**
 * Resolve the wasm-posix-kernel host package and binaries at runtime.
 *
 * The kernel project lives in a sibling repository, not as an npm
 * dependency. We dynamic-import the host class and locate the wasm
 * artifacts on disk so vite/esbuild won't try to bundle them.
 *
 * The checkout must contain a built `host/dist/index.js` and the
 * binaries under `local-binaries/` or `binaries/`.
 */

import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { joinPaths } from '@php-wasm/util';

/** Subset of NodeKernelHost's options the CLI uses. */
export interface NodeKernelHostOptions {
	maxWorkers?: number;
	onStdout?: (pid: number, data: Uint8Array) => void;
	onStderr?: (pid: number, data: Uint8Array) => void;
}

export interface SpawnOptions {
	env?: string[];
	cwd?: string;
	stdin?: Uint8Array;
}

export interface NodeKernelHost {
	init(kernelWasmBytes?: ArrayBuffer): Promise<void>;
	spawn(
		programBytes: ArrayBuffer,
		argv: string[],
		options?: SpawnOptions
	): Promise<number>;
	destroy(): Promise<void>;
}

export interface NodeKernelHostConstructor {
	new (options?: NodeKernelHostOptions): NodeKernelHost;
}

export interface PosixKernelBinaries {
	kernelWasm: string;
	nginxWasm: string;
	phpFpmWasm: string;
	phpWasm: string;
}

export interface HostBridge {
	NodeKernelHost: NodeKernelHostConstructor;
	binaries: PosixKernelBinaries;
	kernelDir: string;
}

let cached: Promise<HostBridge> | undefined;

export function loadHostBridge(): Promise<HostBridge> {
	if (cached === undefined) {
		cached = doLoadHostBridge();
	}
	return cached;
}

async function doLoadHostBridge(): Promise<HostBridge> {
	const kernelDir = resolveKernelDir();
	const binaries = resolveKernelBinaries(kernelDir);
	const NodeKernelHost = await loadNodeKernelHost(kernelDir);
	return { NodeKernelHost, binaries, kernelDir };
}

function resolveKernelDir(): string {
	const fromEnv = process.env['WASM_POSIX_KERNEL_DIR'];
	if (!fromEnv || fromEnv.trim() === '') {
		throw new Error(
			`WASM_POSIX_KERNEL_DIR is not set. ` +
				`--experimental-posix-kernel requires a wasm-posix-kernel ` +
				`checkout containing 'host/dist/index.js' and the kernel ` +
				`binaries. Set WASM_POSIX_KERNEL_DIR to its absolute path.`
		);
	}
	if (!existsSync(joinPaths(fromEnv, 'host'))) {
		throw new Error(
			`wasm-posix-kernel checkout not found at ${fromEnv}. ` +
				`WASM_POSIX_KERNEL_DIR must point to a working tree that ` +
				`contains 'host/dist/index.js' and the kernel binaries.`
		);
	}
	return fromEnv;
}

function resolveKernelBinaries(kernelDir: string): PosixKernelBinaries {
	return {
		kernelWasm: requireBinary(kernelDir, 'kernel.wasm'),
		nginxWasm: requireBinary(kernelDir, 'programs/wasm32/nginx.wasm'),
		phpFpmWasm: requireBinary(
			kernelDir,
			'programs/wasm32/php/php-fpm.wasm'
		),
		phpWasm: requireBinary(kernelDir, 'programs/wasm32/php/php.wasm'),
	};
}

/**
 * Mirror wasm-posix-kernel's `host/src/binary-resolver.ts` lookup:
 * `local-binaries/<rel>` first, then `binaries/<rel>`.
 */
function requireBinary(kernelDir: string, relPath: string): string {
	for (const root of ['local-binaries', 'binaries']) {
		const candidate = joinPaths(kernelDir, root, relPath);
		if (existsSync(candidate)) {
			return candidate;
		}
	}
	throw new Error(
		`wasm-posix-kernel binary not found: ${relPath}. ` +
			`Looked under ${kernelDir}/local-binaries and ${kernelDir}/binaries. `
	);
}

async function loadNodeKernelHost(
	kernelDir: string
): Promise<NodeKernelHostConstructor> {
	const distEntry = joinPaths(kernelDir, 'host', 'dist', 'index.js');
	if (!existsSync(distEntry)) {
		throw new Error(
			`wasm-posix-kernel host build not found at ${distEntry}. ` +
				`Run 'npm install && npm run build' inside ${kernelDir}/host.`
		);
	}
	const url = pathToFileURL(distEntry).href;
	const mod = (await import(/* @vite-ignore */ url)) as {
		NodeKernelHost?: NodeKernelHostConstructor;
	};
	if (typeof mod.NodeKernelHost !== 'function') {
		throw new Error(
			`Loaded ${distEntry} but it does not export NodeKernelHost.`
		);
	}
	return mod.NodeKernelHost;
}
