import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { joinPaths } from '@php-wasm/util';

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

export interface NodeKernelHost {
	init(kernelWasmBytes?: ArrayBuffer): Promise<void>;
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
	const fromEnv = process.env['KANDELO_DIR'];
	if (!fromEnv || fromEnv.trim() === '') {
		throw new Error(
			`KANDELO_DIR is not set. --experimental-posix-kernel needs ` +
				`a kandelo checkout (host/dist/index.js + binaries).`
		);
	}
	if (!existsSync(joinPaths(fromEnv, 'host'))) {
		throw new Error(`kandelo checkout not found at ${fromEnv}.`);
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
		zipSo: requireBinary(kernelDir, 'programs/wasm32/php/zip.so'),
		curlSo: requireBinary(kernelDir, 'programs/wasm32/php/curl.so'),
		pharSo: requireBinary(kernelDir, 'programs/wasm32/php/phar.so'),
	};
}

function requireBinary(kernelDir: string, relPath: string): string {
	for (const root of ['local-binaries', 'binaries']) {
		const candidate = joinPaths(kernelDir, root, relPath);
		if (existsSync(candidate)) {
			return candidate;
		}
	}
	throw new Error(
		`kandelo binary not found: ${relPath} ` +
			`(looked under ${kernelDir}/{local-binaries,binaries}).`
	);
}

async function loadNodeKernelHost(
	kernelDir: string
): Promise<NodeKernelHostConstructor> {
	const distEntry = joinPaths(kernelDir, 'host', 'dist', 'index.js');
	if (!existsSync(distEntry)) {
		throw new Error(
			`kandelo host build not found at ${distEntry}: ` +
				`run 'npm install && npm run build' inside ${kernelDir}/host.`
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
