/**
 * Boot WordPress backed by wasm-posix-kernel.
 *
 * Spawns one Node `worker_thread` that owns the kernel; inside it,
 * php-fpm listens on a per-boot host-reserved port and nginx listens
 * on the user-chosen port (both via the kernel's TCP bridge to the
 * host — see `kernel-worker.ts:startTcpListener`). The returned
 * `runtime` lets blueprint v1 spawn additional `php.wasm` CLI
 * processes against the same worker, capturing their stdout/stderr.
 *
 * Path duality: callers pass two views of every directory the kernel
 * needs to see — a native `hostPath` (for our own Node `fs.*`) and a
 * `kernelPath` shaped via `@php-wasm/util:toPosixPath`. The kernel's
 * Node-side bridge (`NodePlatformIO.rewritePath`) reverses
 * `kernelPath` back to native form before each `fs.*` call. On
 * macOS/Linux the two paths are identical; on Windows the kernel
 * path is `/C/Users/...` while the host path is `C:\Users\...`. PHP-
 * FPM and nginx (musl-libc inside the kernel) only see the POSIX-
 * shaped form, so their `path[0] == '/'` "absolute" check passes.
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
import { reserveFreePort } from '../start-server';

import ROUTER_PHP from './router.php?raw';
import NGINX_CONF_TEMPLATE from './configs/nginx.conf?raw';
import PHP_FPM_CONF from './configs/php-fpm.conf?raw';

export interface PosixKernelBootOptions {
	host?: string;
	port: number;
	serverName?: string;
	wordPressRootHostPath: string;
	wordPressRootKernelPath: string;
	tempDirHostPath: string;
	tempDirKernelPath: string;
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
	runtime: KernelRuntime;
	resetFirstRequestMarker: () => void;
	[Symbol.asyncDispose](): Promise<void>;
}

const FPM_BOOT_GRACE_MS = 2_000;
const NGINX_READY_TIMEOUT_MS = 15_000;

export async function bootPosixKernelWordPress(
	options: PosixKernelBootOptions
): Promise<PosixKernelBootResult> {
	if (!existsSync(joinPaths(options.wordPressRootHostPath, 'index.php'))) {
		throw new Error(
			`No PHP entry point found at ${options.wordPressRootHostPath}/index.php. ` +
				`The posix-kernel handler expects the document root to be ` +
				`prepared (e.g. populated with WordPress) before calling ` +
				`bootPosixKernelWordPress().`
		);
	}

	mkdirSync(options.tempDirHostPath, { recursive: true });
	for (const sub of ['client_body_temp', 'fastcgi_temp', 'logs']) {
		mkdirSync(joinPaths(options.tempDirHostPath, sub), { recursive: true });
	}

	const bridge = await loadHostBridge();

	logger.debug(`[posix-kernel] using kernel checkout at ${bridge.kernelDir}`);

	const phpFpmBytes = readWasm(bridge.binaries.phpFpmWasm);
	const nginxBytes = readWasm(bridge.binaries.nginxWasm);

	// Reserve a free host port for php-fpm. The kernel's TCP bridge
	// (`kernel-worker.ts:startTcpListener`) translates a kernel-side
	// `listen()` into a real `net.createServer().listen(port, "0.0.0.0")`
	// — so two concurrently-booted kernels can't share a hard-coded
	// 9000 without colliding with `EADDRINUSE`. The port is internal
	// (only nginx-in-the-kernel talks to it via fastcgi_pass).
	const fpmPort = await reserveFreePort();

	// Materialize the FastCGI router + php-fpm config from inlined
	// `?raw` strings so the published CLI bundle is self-contained
	// (no neighbouring .php / .conf source files in dist/).
	writeFileSync(joinPaths(options.tempDirHostPath, 'router.php'), ROUTER_PHP);
	const routerScriptKernelPath = joinPaths(
		options.tempDirKernelPath,
		'router.php'
	);
	writeFileSync(
		joinPaths(options.tempDirHostPath, 'php-fpm.conf'),
		PHP_FPM_CONF.replaceAll('__FPM_PORT__', String(fpmPort))
	);
	const fpmConfKernelPath = joinPaths(
		options.tempDirKernelPath,
		'php-fpm.conf'
	);
	// The marker path is wired into nginx now, but the file is created
	// later (by the handler, after the WP installer probe). If the file
	// existed during the install probe, router.php would short-circuit
	// the probe with a 302, defeating ensureWordPressInstalled's
	// install.php detection.
	const firstRequestMarkerHostPath = joinPaths(
		options.tempDirHostPath,
		'first-request-pending'
	);
	const firstRequestMarkerKernelPath = joinPaths(
		options.tempDirKernelPath,
		'first-request-pending'
	);
	const host = options.host ?? DEFAULT_HOST;
	const renderedNginxConfKernelPath = renderNginxConf({
		host,
		port: options.port,
		fpmPort,
		serverName: options.serverName ?? 'localhost',
		wordPressRootKernelPath: options.wordPressRootKernelPath,
		routerScriptKernelPath,
		tempDirHostPath: options.tempDirHostPath,
		tempDirKernelPath: options.tempDirKernelPath,
		firstRequestMarkerKernelPath,
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
			fpmConfKernelPath,
			options.wordPressRootKernelPath
		);
		// FPM is kernel-internal (only nginx-in-the-kernel connects to
		// it); probe the kernel's loopback bridge, not the user-chosen
		// nginx bind host.
		await waitForLoopback(DEFAULT_HOST, fpmPort, FPM_BOOT_GRACE_MS).catch(
			() => {
				/* nginx will retry */
			}
		);

		spawnNginx(
			kernelHost,
			nginxBytes,
			renderedNginxConfKernelPath,
			options.tempDirKernelPath
		);
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
		runtime,
		resetFirstRequestMarker: () =>
			writeFileSync(firstRequestMarkerHostPath, ''),
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
	fpmPort: number;
	serverName: string;
	wordPressRootKernelPath: string;
	routerScriptKernelPath: string;
	tempDirHostPath: string;
	tempDirKernelPath: string;
	firstRequestMarkerKernelPath: string;
	template: string;
}): string {
	const rendered = args.template
		.replaceAll('__HOST__', args.host)
		.replaceAll('__PORT__', String(args.port))
		.replaceAll('__FPM_PORT__', String(args.fpmPort))
		.replaceAll('__SERVER_NAME__', args.serverName)
		.replaceAll('__WORDPRESS_ROOT__', args.wordPressRootKernelPath)
		.replaceAll('__ROUTER_SCRIPT__', args.routerScriptKernelPath)
		.replaceAll('__TEMP_DIR__', args.tempDirKernelPath)
		.replaceAll(
			'__FIRST_REQUEST_MARKER__',
			args.firstRequestMarkerKernelPath
		);
	const outHostPath = joinPaths(args.tempDirHostPath, 'nginx.conf');
	writeFileSync(outHostPath, rendered);
	// Return the kernel-shaped path; the spawned nginx parses argv
	// through musl-libc, which only treats `/`-rooted paths as absolute.
	return joinPaths(args.tempDirKernelPath, 'nginx.conf');
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
