/**
 * Boot WordPress backed by wasm-posix-kernel.
 *
 * Spawns one Node `worker_thread` that owns the kernel; inside it,
 * php-fpm listens on the kernel's TCP loopback (127.0.0.1:9000) and
 * nginx listens on the user-chosen port (kernel TCP bridge to the host).
 * The returned `runtime` lets blueprint v1 spawn additional `php.wasm`
 * CLI processes against the same worker, capturing their stdout/stderr.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { connect } from 'node:net';
import { logger } from '@php-wasm/logger';
import { joinPaths } from '@php-wasm/util';
import {
	loadHostBridge,
	type NodeKernelHost,
	type SpawnOptions,
} from './host-bridge';

const dir = typeof __dirname !== 'undefined' ? __dirname : import.meta.dirname;

export interface PosixKernelBootOptions {
	port: number;
	serverName?: string;
	wordPressRoot: string;
	tempDir: string;
}

export interface KernelRuntime {
	host: NodeKernelHost;
	phpWasmPath: string;
	spawnCapturing(args: {
		programBytes: ArrayBuffer;
		argv: string[];
		options?: SpawnOptions;
	}): Promise<{ exitCode: number; stdout: Uint8Array; stderr: Uint8Array }>;
}

export interface PosixKernelBootResult extends AsyncDisposable {
	serverUrl: string;
	wordPressRoot: string;
	runtime: KernelRuntime;
	[Symbol.asyncDispose](): Promise<void>;
}

const FPM_LOOPBACK_PORT = 9000;
const FPM_BOOT_GRACE_MS = 2_000;
const NGINX_READY_TIMEOUT_MS = 15_000;

export async function bootPosixKernelWordPress(
	options: PosixKernelBootOptions
): Promise<PosixKernelBootResult> {
	if (!existsSync(joinPaths(options.wordPressRoot, 'index.php'))) {
		throw new Error(
			`No PHP entry point found at ${options.wordPressRoot}/index.php. ` +
				`The posix-kernel handler expects the document root to be ` +
				`prepared (e.g. populated with WordPress) before calling ` +
				`bootPosixKernelWordPress().`
		);
	}

	mkdirSync(options.tempDir, { recursive: true });
	for (const sub of ['client_body_temp', 'fastcgi_temp', 'logs']) {
		mkdirSync(joinPaths(options.tempDir, sub), { recursive: true });
	}

	const bridge = await loadHostBridge();

	logger.debug(`[posix-kernel] using kernel checkout at ${bridge.kernelDir}`);

	const phpFpmBytes = readWasm(bridge.binaries.phpFpmWasm);
	const nginxBytes = readWasm(bridge.binaries.nginxWasm);

	const routerScriptPath = joinPaths(dir, 'router.php');
	const fpmConfPath = joinPaths(dir, 'configs', 'php-fpm.conf');
	const renderedNginxConf = renderNginxConf({
		port: options.port,
		serverName: options.serverName ?? 'localhost',
		wordPressRoot: options.wordPressRoot,
		routerScript: routerScriptPath,
		tempDir: options.tempDir,
	});

	// Time-multiplexed stdio capture. The kernel currently emits every
	// stdout/stderr chunk with `pid: 0` (per-pid demux not yet wired), so
	// we route bytes by who the active capture is at receive time.
	// `spawnCapturing` serializes itself behind a promise chain, keeping
	// at most one capture in flight. nginx/php-fpm log lines that fire
	// while a capture is active will be pulled into that capture's
	// buffer — fine because v1 callsites don't generate concurrent HTTP
	// traffic during their `run`/`request` calls.
	interface ActiveCapture {
		stdout: Uint8Array[];
		stderr: Uint8Array[];
	}

	let activeCapture: ActiveCapture | null = null;

	const host = new bridge.NodeKernelHost({
		maxWorkers: 8,
		onStdout: (_pid, data) => {
			if (activeCapture) {
				activeCapture.stdout.push(data);
			} else {
				process.stdout.write(data);
			}
		},
		onStderr: (_pid, data) => {
			if (activeCapture) {
				activeCapture.stderr.push(data);
			} else {
				process.stderr.write(data);
			}
		},
	});
	await host.init();

	let disposed = false;

	const dispose = async () => {
		if (disposed) {
			return;
		}
		disposed = true;
		try {
			await host.destroy();
		} catch (e) {
			logger.debug(
				`[posix-kernel] host.destroy() raised: ${describeError(e)}`
			);
		}
	};

	try {
		spawnPhpFpm(host, phpFpmBytes, fpmConfPath, options.wordPressRoot);
		await waitForLoopback(FPM_LOOPBACK_PORT, FPM_BOOT_GRACE_MS).catch(
			() => {
				/* nginx will retry */
			}
		);

		spawnNginx(host, nginxBytes, renderedNginxConf, dir);
		await waitForLoopback(options.port, NGINX_READY_TIMEOUT_MS);
	} catch (e) {
		await dispose();
		throw e;
	}

	let captureChain: Promise<unknown> = Promise.resolve();

	const runtime: KernelRuntime = {
		host,
		phpWasmPath: bridge.binaries.phpWasm,
		spawnCapturing({ programBytes, argv, options: spawnOptions }) {
			const next = captureChain.then(async () => {
				const capture: ActiveCapture = { stdout: [], stderr: [] };
				activeCapture = capture;
				try {
					const exitCode = await host.spawn(
						programBytes,
						argv,
						spawnOptions
					);
					return {
						exitCode,
						stdout: concatBytes(capture.stdout),
						stderr: concatBytes(capture.stderr),
					};
				} finally {
					if (activeCapture === capture) {
						activeCapture = null;
					}
				}
			});
			// Keep the chain alive even if a caller's promise rejects, so
			// the next queued capture can still proceed.
			captureChain = next.catch(() => undefined);
			return next;
		},
	};

	return {
		serverUrl: `http://127.0.0.1:${options.port}`,
		wordPressRoot: options.wordPressRoot,
		runtime,
		async [Symbol.asyncDispose]() {
			await dispose();
		},
	};
}

function readWasm(path: string): ArrayBuffer {
	const buf = readFileSync(path);
	return buf.buffer.slice(
		buf.byteOffset,
		buf.byteOffset + buf.byteLength
	) as ArrayBuffer;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
	let total = 0;
	for (const c of chunks) {
		total += c.byteLength;
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) {
		out.set(c, offset);
		offset += c.byteLength;
	}
	return out;
}

function renderNginxConf(args: {
	port: number;
	serverName: string;
	wordPressRoot: string;
	routerScript: string;
	tempDir: string;
}): string {
	const template = readFileSync(
		joinPaths(dir, 'configs', 'nginx.conf'),
		'utf8'
	);
	const rendered = template
		.replaceAll('__PORT__', String(args.port))
		.replaceAll('__SERVER_NAME__', args.serverName)
		.replaceAll('__WORDPRESS_ROOT__', args.wordPressRoot)
		.replaceAll('__ROUTER_SCRIPT__', args.routerScript);
	const outPath = joinPaths(args.tempDir, 'nginx.conf');
	writeFileSync(outPath, rendered);
	return outPath;
}

function spawnPhpFpm(
	host: NodeKernelHost,
	bytes: ArrayBuffer,
	confPath: string,
	cwd: string
): void {
	spawnLongRunning(
		host,
		'php-fpm',
		bytes,
		['php-fpm', '-y', confPath, '-c', '/dev/null', '--nodaemonize'],
		cwd
	);
}

function spawnNginx(
	host: NodeKernelHost,
	bytes: ArrayBuffer,
	confPath: string,
	cwd: string
): void {
	spawnLongRunning(
		host,
		'nginx',
		bytes,
		['nginx', '-p', `${cwd}/`, '-c', confPath],
		cwd
	);
}

function spawnLongRunning(
	host: NodeKernelHost,
	name: string,
	bytes: ArrayBuffer,
	argv: string[],
	cwd: string
): void {
	host.spawn(bytes, argv, {
		env: ['HOME=/tmp', 'PATH=/usr/local/bin:/usr/bin:/bin'],
		cwd,
	}).then(
		(status) => {
			logger.debug(`[posix-kernel] ${name} exited with status ${status}`);
		},
		(error) => {
			logger.error(
				`[posix-kernel] ${name} spawn failed: ${describeError(error)}`
			);
		}
	);
}

async function waitForLoopback(port: number, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	let lastError: unknown;
	while (Date.now() < deadline) {
		try {
			await new Promise<void>((resolve, reject) => {
				const socket = connect({ port, host: '127.0.0.1' });
				socket.once('connect', () => {
					socket.end();
					resolve();
				});
				socket.once('error', reject);
			});
			return;
		} catch (e) {
			lastError = e;
			await new Promise((resolve) => setTimeout(resolve, 150));
		}
	}
	throw new Error(
		`Timed out waiting for 127.0.0.1:${port} after ${timeoutMs}ms ` +
			`(${describeError(lastError)}).`
	);
}

function describeError(e: unknown): string {
	if (e instanceof Error) {
		return e.message;
	}
	return String(e);
}
