import {
	writeFileSync,
	mkdirSync,
	chmodSync,
	existsSync,
	copyFileSync,
} from 'node:fs';
import { connect } from 'node:net';
import { logger } from '@php-wasm/logger';
import { basename, joinPaths } from '@php-wasm/util';
import {
	loadHostBridge,
	readWasm,
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
// Parallel forks cold-start several kernels at once; 15s flaked on
// busy boxes and 60s still flaked on loaded CI runners (vitest runs
// several kernel-booting suites concurrently).
const NGINX_READY_TIMEOUT_MS = 180_000;

export async function bootPosixKernelWordPress(
	options: PosixKernelBootOptions
): Promise<PosixKernelBootResult> {
	if (!existsSync(joinPaths(options.wordPressRootHostPath, 'index.php'))) {
		throw new Error(
			`No PHP entry point at ${options.wordPressRootHostPath}/index.php. ` +
				`Prepare the document root before calling ` +
				`bootPosixKernelWordPress().`
		);
	}

	mkdirSync(options.tempDirHostPath, { recursive: true });
	// FPM workers run as uid 99: dir must be world-traversable for
	// SCRIPT_FILENAME and world-writable for router.php's @unlink of
	// the first-request marker.
	chmodSync(options.tempDirHostPath, 0o777);
	for (const sub of ['client_body_temp', 'fastcgi_temp', 'logs']) {
		mkdirSync(joinPaths(options.tempDirHostPath, sub), { recursive: true });
	}

	const bridge = await loadHostBridge();

	logger.debug(`[posix-kernel] using kernel checkout at ${bridge.kernelDir}`);

	const phpFpmBytes = readWasm(bridge.binaries.phpFpmWasm);
	const nginxBytes = readWasm(bridge.binaries.nginxWasm);

	// A kandelo fetch may place the extensions as symlinks into
	// ~/.cache/kandelo, and kandelo's host-directory mount can't stat
	// through symlinks that leave the mount root — dlopen would fail with
	// "cannot stat library". Copy the real files into the boot temp dir
	// and mount the copies at /usr/lib/php/extensions.
	const phpExtensionsHostDir = joinPaths(
		options.tempDirHostPath,
		'php-extensions'
	);
	mkdirSync(phpExtensionsHostDir, { recursive: true });
	for (const soHostPath of [
		bridge.binaries.zipSo,
		bridge.binaries.curlSo,
		bridge.binaries.pharSo,
	]) {
		copyFileSync(
			soHostPath,
			joinPaths(phpExtensionsHostDir, basename(soHostPath))
		);
	}
	const phpExtensionsKernelDir = '/usr/lib/php/extensions';

	// kandelo's TCP bridge maps a kernel `listen()` to a real
	// `net.createServer().listen(port, "0.0.0.0")`, so two concurrent
	// kernels can't share a hard-coded fpm port.
	const fpmPort = await reserveFreePort();

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
	// Path is wired into nginx now but the file is created later by the
	// handler, after ensureWordPressInstalled — if it existed during the
	// install probe, router.php would 302 it and defeat install detection.
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

	// kandelo emits every stdout/stderr chunk with pid=0 (no per-pid
	// demux yet), so spawnCapturing serializes behind a chain and routes
	// bytes to whichever capture is active at receive time. Concurrent
	// nginx/php-fpm log lines land in that buffer — acceptable because v1
	// callsites don't drive HTTP traffic during a captured run.
	interface ActiveCapture {
		stdout: Uint8Array[];
		stderr: Uint8Array[];
	}

	let activeCapture: ActiveCapture | null = null;

	const kernelHost = new bridge.NodeKernelHost({
		maxWorkers: 8,
		rootfsImage: 'default',
		// Always on, mirroring the browser kernel, which attaches its TLS
		// backend regardless of `features.networking`. The browser gates
		// networking one layer up (disabling `curl_exec`/`allow_url_fopen`
		// in the FPM pool), not at the transport; the CLI doesn't wire that
		// PHP-level gate yet.
		enableTcpNetwork: true,
		extraMounts: [
			{
				mountPoint: options.tempDirKernelPath,
				hostPath: options.tempDirHostPath,
			},
			{
				mountPoint: options.wordPressRootKernelPath,
				hostPath: options.wordPressRootHostPath,
			},
			{
				mountPoint: phpExtensionsKernelDir,
				hostPath: phpExtensionsHostDir,
				readonly: true,
			},
		],
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
		spawnNginx(
			kernelHost,
			nginxBytes,
			renderedNginxConfKernelPath,
			options.tempDirKernelPath
		);
		spawnPhpFpm(
			kernelHost,
			phpFpmBytes,
			fpmConfKernelPath,
			options.wordPressRootKernelPath
		);
		// FPM is kernel-internal; probe loopback, not the user-chosen
		// nginx bind host.
		await waitForLoopback(DEFAULT_HOST, fpmPort, FPM_BOOT_GRACE_MS).catch(
			() => {
				/* nginx will retry */
			}
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
			// Keep the chain alive on rejection so the next queued capture
			// can still proceed.
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
	// Return the kernel path: nginx parses argv through musl, which only
	// treats `/`-rooted paths as absolute.
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
		[
			'php-fpm',
			'-y',
			confPath,
			'-c',
			'/dev/null',
			'-d',
			'extension_dir=/usr/lib/php/extensions',
			'-d',
			'extension=zip.so',
			'-d',
			'extension=curl.so',
			'-d',
			'extension=phar.so',
			// The WASM curl.so has no built-in CA bundle; point it at the
			// one the kernel worker installs. Mirrors vfs-builder.ts.
			'-d',
			'curl.cainfo=/etc/ssl/certs/ca-certificates.crt',
			'--nodaemonize',
		],
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
