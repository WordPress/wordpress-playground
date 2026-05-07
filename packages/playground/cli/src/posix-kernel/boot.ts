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

import ROUTER_PHP from './router.php?raw';
import NGINX_CONF_TEMPLATE from './configs/nginx.conf?raw';
import PHP_FPM_CONF from './configs/php-fpm.conf?raw';

export interface PosixKernelBootOptions {
	host?: string;
	port: number;
	serverName?: string;
	wordPressRoot: string;
	tempDir: string;
}

const DEFAULT_HOST = '127.0.0.1';

export interface KernelRuntime {
	kernelHost: NodeKernelHost;
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
	resetFirstRequestMarker: () => void;
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

	// Materialize the FastCGI router + php-fpm config from inlined
	// `?raw` strings so the published CLI bundle is self-contained
	// (no neighbouring .php / .conf source files in dist/).
	const routerScriptPath = joinPaths(options.tempDir, 'router.php');
	writeFileSync(routerScriptPath, ROUTER_PHP);
	const fpmConfPath = joinPaths(options.tempDir, 'php-fpm.conf');
	writeFileSync(fpmConfPath, PHP_FPM_CONF);
	// The marker path is wired into nginx now, but the file is created
	// later (by the handler, after the WP installer probe). If the file
	// existed during the install probe, router.php would short-circuit
	// the probe with a 302, defeating ensureWordPressInstalled's
	// install.php detection.
	const firstRequestMarker = joinPaths(
		options.tempDir,
		'first-request-pending'
	);
	const host = options.host ?? DEFAULT_HOST;
	const renderedNginxConf = renderNginxConf({
		host,
		port: options.port,
		serverName: options.serverName ?? 'localhost',
		wordPressRoot: options.wordPressRoot,
		routerScript: routerScriptPath,
		tempDir: options.tempDir,
		firstRequestMarker,
		template: NGINX_CONF_TEMPLATE,
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

	const kernelHost = new bridge.NodeKernelHost({
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
	await kernelHost.init();

	let disposed = false;

	const dispose = async () => {
		if (disposed) {
			return;
		}
		disposed = true;
		try {
			await kernelHost.destroy();
		} catch (e) {
			logger.debug(
				`[posix-kernel] kernelHost.destroy() raised: ${describeError(e)}`
			);
		}
	};

	try {
		spawnPhpFpm(
			kernelHost,
			phpFpmBytes,
			fpmConfPath,
			options.wordPressRoot
		);
		// FPM is kernel-internal; probe the kernel's loopback bridge,
		// not the user-chosen nginx bind host.
		await waitForLoopback(
			DEFAULT_HOST,
			FPM_LOOPBACK_PORT,
			FPM_BOOT_GRACE_MS
		).catch(() => {
			/* nginx will retry */
		});

		spawnNginx(kernelHost, nginxBytes, renderedNginxConf, options.tempDir);
		await waitForLoopback(host, options.port, NGINX_READY_TIMEOUT_MS);
	} catch (e) {
		await dispose();
		throw e;
	}

	let captureChain: Promise<unknown> = Promise.resolve();

	const runtime: KernelRuntime = {
		kernelHost,
		phpWasmPath: bridge.binaries.phpWasm,
		spawnCapturing({ programBytes, argv, options: spawnOptions }) {
			const next = captureChain.then(async () => {
				const capture: ActiveCapture = { stdout: [], stderr: [] };
				activeCapture = capture;
				try {
					const exitCode = await kernelHost.spawn(
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
		serverUrl: `http://${host}:${options.port}`,
		wordPressRoot: options.wordPressRoot,
		runtime,
		resetFirstRequestMarker: () => writeFileSync(firstRequestMarker, ''),
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
	host: string;
	port: number;
	serverName: string;
	wordPressRoot: string;
	routerScript: string;
	tempDir: string;
	firstRequestMarker: string;
	template: string;
}): string {
	const rendered = args.template
		.replaceAll('__HOST__', args.host)
		.replaceAll('__PORT__', String(args.port))
		.replaceAll('__SERVER_NAME__', args.serverName)
		.replaceAll('__WORDPRESS_ROOT__', args.wordPressRoot)
		.replaceAll('__ROUTER_SCRIPT__', args.routerScript)
		.replaceAll('__FIRST_REQUEST_MARKER__', args.firstRequestMarker);
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

async function waitForLoopback(
	host: string,
	port: number,
	timeoutMs: number
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	let lastError: unknown;
	while (Date.now() < deadline) {
		try {
			await new Promise<void>((resolve, reject) => {
				const socket = connect({ port, host });
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
		`Timed out waiting for ${host}:${port} after ${timeoutMs}ms ` +
			`(${describeError(lastError)}).`
	);
}

function describeError(e: unknown): string {
	if (e instanceof Error) {
		return e.message;
	}
	return String(e);
}
