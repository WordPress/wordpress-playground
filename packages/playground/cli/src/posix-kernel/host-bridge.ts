import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'module';
import { pathToFileURL } from 'node:url';
import { dirname, joinPaths } from '@php-wasm/util';

export function readWasm(path: string): ArrayBuffer {
	const buf = readFileSync(path);
	return buf.buffer.slice(
		buf.byteOffset,
		buf.byteOffset + buf.byteLength
	) as ArrayBuffer;
}

export interface NodeKernelHostOptions {
	maxWorkers?: number;
	onStdout?: (pid: number, data: Uint8Array) => void;
	onStderr?: (pid: number, data: Uint8Array) => void;
	rootfsImage?: 'default' | ArrayBuffer | Uint8Array;
	extraMounts?: Array<{
		mountPoint: string;
		hostPath: string;
		readonly?: boolean;
	}>;

	enableTcpNetwork?: boolean;
}

export interface SpawnOptions {
	env?: string[];
	cwd?: string;
	stdin?: Uint8Array;
	onStarted?: (pid: number) => void;
}

export interface KernelHttpRequest {
	method: string;
	url: string;
	headers: Record<string, string>;
	body: Uint8Array | null;
}

export interface KernelHttpResponse {
	status: number;
	headers: Record<string, string>;
	body: Uint8Array;
}

export interface KernelVfsStat {
	mode: number;
}

export interface KernelVfsDirEntry extends KernelVfsStat {
	name: string;
}

export interface NodeKernelHost {
	init(kernelWasmBytes?: ArrayBuffer): Promise<void>;
	readFileFromVfs(path: string): Promise<Uint8Array | null>;
	writeFileToVfs(path: string, data: Uint8Array): Promise<void>;
	statVfsPath(path: string): Promise<KernelVfsStat | null>;
	readDirFromVfs(path: string): Promise<KernelVfsDirEntry[] | null>;
	spawn(
		programBytes: ArrayBuffer,
		argv: string[],
		options?: SpawnOptions
	): Promise<number>;
	fetchInKernel(
		port: number,
		request: KernelHttpRequest,
		options?: { timeoutMs?: number }
	): Promise<KernelHttpResponse>;
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
	zipSo: string;
	curlSo: string;
	pharSo: string;
}

interface KernelHostModule {
	NodeKernelHost: NodeKernelHostConstructor;
	resolveBinary: (relPath: string) => string;
}

export interface HostBridge {
	NodeKernelHost: NodeKernelHostConstructor;
	binaries: PosixKernelBinaries;
	kernelDir: string;
}

let cached: Promise<HostBridge> | undefined;

export function loadHostBridge(): Promise<HostBridge> {
	if (cached === undefined) {
		cached = doLoadHostBridge().catch((e) => {
			cached = undefined;
			throw e;
		});
	}
	return cached;
}

async function doLoadHostBridge(): Promise<HostBridge> {
	const kernelDir = resolveKernelDir();
	selectSourceOnlyBinaries(kernelDir);
	const host = await loadKernelHostModule(kernelDir);
	const binaries = resolveKernelBinaries(host.resolveBinary);
	return { NodeKernelHost: host.NodeKernelHost, binaries, kernelDir };
}

function resolveKernelDir(): string {
	const kernelDir =
		process.env['KANDELO_DIR']?.trim() || resolvePosixKernelBuildsDir();
	if (!existsSync(joinPaths(kernelDir, 'host'))) {
		throw new Error(`kandelo checkout not found at ${kernelDir}.`);
	}
	return kernelDir;
}

function resolvePosixKernelBuildsDir(): string {
	const require = createRequire(import.meta.url);
	return dirname(
		require.resolve('@wp-playground/posix-kernel-builds/package.json')
	);
}

function selectSourceOnlyBinaries(kernelDir: string): void {
	const projection = joinPaths(kernelDir, 'local-binaries', 'source-only-v1');
	if (!existsSync(projection)) {
		throw new Error(
			`kandelo binaries not found at ${projection}: run ` +
				`'npx nx bundle-kandelo playground-posix-kernel-builds'.`
		);
	}
	process.env['WASM_POSIX_RESOLUTION_POLICY'] = 'source-only-v1';
	process.env['WASM_POSIX_SOURCE_ONLY_BINARY_ROOT'] =
		realpathSync(projection);
}

function resolveKernelBinaries(
	resolveBinary: (relPath: string) => string
): PosixKernelBinaries {
	return {
		kernelWasm: resolveBinary('kernel.wasm'),
		nginxWasm: resolveBinary('programs/wasm32/nginx.wasm'),
		phpFpmWasm: resolveBinary('programs/wasm32/php/php-fpm.wasm'),
		phpWasm: resolveBinary('programs/wasm32/php/php.wasm'),
		zipSo: resolveBinary('programs/wasm32/php/zip.so'),
		curlSo: resolveBinary('programs/wasm32/php/curl.so'),
		pharSo: resolveBinary('programs/wasm32/php/phar.so'),
	};
}

async function loadKernelHostModule(
	kernelDir: string
): Promise<KernelHostModule> {
	const distEntry = joinPaths(kernelDir, 'host', 'dist', 'index.js');
	if (!existsSync(distEntry)) {
		throw new Error(
			`kandelo host build not found at ${distEntry}: run ` +
				`'npx nx bundle-kandelo playground-posix-kernel-builds'.`
		);
	}
	const url = pathToFileURL(distEntry).href;
	const mod = (await import(
		/* @vite-ignore */ url
	)) as Partial<KernelHostModule>;
	if (typeof mod.NodeKernelHost !== 'function') {
		throw new Error(
			`Loaded ${distEntry} but it does not export NodeKernelHost.`
		);
	}
	if (typeof mod.resolveBinary !== 'function') {
		throw new Error(
			`Loaded ${distEntry} but it does not export resolveBinary.`
		);
	}
	return mod as KernelHostModule;
}
