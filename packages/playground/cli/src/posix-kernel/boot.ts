import { writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { logger } from '@php-wasm/logger';
import { basename, joinPaths } from '@php-wasm/util';
import {
	loadHostBridge,
	readWasm,
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
	wordPressRootHostPath: string;
	wordPressRootKernelPath: string;
	tempDirHostPath: string;
	tempDirKernelPath: string;
	requireHostTcpPort?: boolean;
	quiet?: boolean;
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

const READINESS_TIMEOUT_MS = 180_000;
const HOST_TCP_TIMEOUT_MS = 10_000;
const PROBE_INTERVAL_MS = 150;
const PROBE_PATH = '/?__playground_probe=1';

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
	for (const sub of ['client_body_temp', 'fastcgi_temp', 'logs']) {
		mkdirSync(joinPaths(options.tempDirHostPath, sub), { recursive: true });
	}

	const bridge = await loadHostBridge();

	logger.debug(`[posix-kernel] using kernel checkout at ${bridge.kernelDir}`);

	const phpFpmBytes = readWasm(bridge.binaries.phpFpmWasm);
	const nginxBytes = readWasm(bridge.binaries.nginxWasm);

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

	const fpmSocketKernelPath = joinPaths(
		options.tempDirKernelPath,
		'php-fpm.sock'
	);

	const bootId = randomUUID();

	writeFileSync(joinPaths(options.tempDirHostPath, 'router.php'), ROUTER_PHP);
	const routerScriptKernelPath = joinPaths(
		options.tempDirKernelPath,
		'router.php'
	);
	writeFileSync(
		joinPaths(options.tempDirHostPath, 'php-fpm.conf'),
		PHP_FPM_CONF.replaceAll('__FPM_SOCKET__', fpmSocketKernelPath)
	);
	const fpmConfKernelPath = joinPaths(
		options.tempDirKernelPath,
		'php-fpm.conf'
	);

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
		fpmSocketKernelPath,
		bootId,
		serverName: options.serverName ?? 'localhost',
		wordPressRootKernelPath: options.wordPressRootKernelPath,
		routerScriptKernelPath,
		tempDirHostPath: options.tempDirHostPath,
		tempDirKernelPath: options.tempDirKernelPath,
		firstRequestMarkerKernelPath,
		template: NGINX_CONF_TEMPLATE,
	});

	interface ActiveCapture {
		stdout: Uint8Array[];
		stderr: Uint8Array[];
	}

	let activeCapture: ActiveCapture | null = null;

	const kernelHost = new bridge.NodeKernelHost({
		maxWorkers: 16,
		rootfsImage: 'default',
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
			} else if (!options.quiet) {
				process.stdout.write(data);
			}
		},
		onStderr: (_pid, data) => {
			if (activeCapture) {
				activeCapture.stderr.push(data);
			} else if (!options.quiet) {
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
		const nginx = spawnLongRunning(
			kernelHost,
			'nginx',
			nginxBytes,
			[
				'nginx',
				'-p',
				`${options.tempDirKernelPath}/`,
				'-c',
				renderedNginxConfKernelPath,
			],
			options.tempDirKernelPath
		);
		const phpFpm = spawnLongRunning(
			kernelHost,
			'php-fpm',
			phpFpmBytes,
			[
				'php-fpm',
				'-y',
				fpmConfKernelPath,
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
				'-d',
				'curl.cainfo=/etc/ssl/certs/ca-certificates.crt',
				'--nodaemonize',
				'-R',
			],
			options.wordPressRootKernelPath
		);

		await waitForFile(
			joinPaths(options.tempDirHostPath, 'php-fpm.sock'),
			phpFpm
		);
		await waitForInKernelReadiness({
			kernelHost,
			port: options.port,
			hostHeader: `${host}:${options.port}`,
			bootId,
			daemons: [nginx, phpFpm],
		});
		if (options.requireHostTcpPort) {
			await waitForHostTcpPort(host, options.port, bootId);
		}
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
	fpmSocketKernelPath: string;
	bootId: string;
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
		.replaceAll('__FPM_SOCKET__', args.fpmSocketKernelPath)
		.replaceAll('__BOOT_ID__', args.bootId)
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

	return joinPaths(args.tempDirKernelPath, 'nginx.conf');
}

interface DaemonHandle {
	name: string;
	exitStatus: number | null;
}

function spawnLongRunning(
	host: NodeKernelHost,
	name: string,
	bytes: ArrayBuffer,
	argv: string[],
	cwd: string
): DaemonHandle {
	const handle: DaemonHandle = { name, exitStatus: null };
	host.spawn(bytes, argv, {
		env: ['HOME=/tmp', 'PATH=/usr/local/bin:/usr/bin:/bin'],
		cwd,
	}).then(
		(status) => {
			handle.exitStatus = status;
			logger.debug(`[posix-kernel] ${name} exited with status ${status}`);
		},
		(error) => {
			handle.exitStatus = -1;
			logger.error(
				`[posix-kernel] ${name} spawn failed: ${describeError(error)}`
			);
		}
	);
	return handle;
}

async function waitForFile(
	hostPath: string,
	daemon: DaemonHandle
): Promise<void> {
	const deadline = Date.now() + READINESS_TIMEOUT_MS;
	while (Date.now() < deadline) {
		if (daemon.exitStatus !== null) {
			throw new Error(
				`${daemon.name} exited with status ${daemon.exitStatus} ` +
					`before WordPress became ready.`
			);
		}
		if (existsSync(hostPath)) {
			return;
		}
		await delay(PROBE_INTERVAL_MS);
	}
	throw new Error(
		`${daemon.name} did not create ${hostPath} within ` +
			`${READINESS_TIMEOUT_MS}ms.`
	);
}

async function waitForInKernelReadiness(args: {
	kernelHost: NodeKernelHost;
	port: number;
	hostHeader: string;
	bootId: string;
	daemons: DaemonHandle[];
}): Promise<void> {
	const deadline = Date.now() + READINESS_TIMEOUT_MS;
	let lastFailure = 'no probe completed';
	while (Date.now() < deadline) {
		const dead = args.daemons.find((d) => d.exitStatus !== null);
		if (dead) {
			throw new Error(
				`${dead.name} exited with status ${dead.exitStatus} before ` +
					`WordPress became ready.`
			);
		}
		try {
			const response = await args.kernelHost.fetchInKernel(
				args.port,
				{
					method: 'GET',
					url: PROBE_PATH,
					headers: { Host: args.hostHeader },
					body: null,
				},
				{ timeoutMs: 5_000 }
			);
			if (
				response.status === 200 &&
				new TextDecoder().decode(response.body) === args.bootId
			) {
				return;
			}
			lastFailure =
				response.status === 502
					? `PHP-FPM is not accepting connections yet (HTTP 502)`
					: `HTTP ${response.status}`;
		} catch (e) {
			lastFailure = describeError(e);
		}
		await delay(PROBE_INTERVAL_MS);
	}
	throw new Error(
		`nginx + PHP-FPM did not become ready within ` +
			`${READINESS_TIMEOUT_MS}ms (last probe: ${lastFailure}).`
	);
}

async function waitForHostTcpPort(
	host: string,
	port: number,
	bootId: string
): Promise<void> {
	const deadline = Date.now() + HOST_TCP_TIMEOUT_MS;
	let lastFailure = 'no probe completed';
	while (Date.now() < deadline) {
		try {
			const response = await fetch(`http://${host}:${port}${PROBE_PATH}`);
			const body = await response.text();
			if (response.status === 200 && body === bootId) {
				return;
			}
			throw new Error(
				`Port ${port} is already in use by another server ` +
					`(http://${host}:${port} answered with a different site).`
			);
		} catch (e) {
			if (!isConnectionRefused(e)) {
				throw e;
			}
			lastFailure = describeError(e);
		}
		await delay(PROBE_INTERVAL_MS);
	}
	throw new Error(
		`nginx never opened ${host}:${port} on the host ` +
			`(last probe: ${lastFailure}).`
	);
}

function isConnectionRefused(e: unknown): boolean {
	const cause = e instanceof Error ? (e.cause ?? e) : e;
	return (
		typeof cause === 'object' &&
		cause !== null &&
		(cause as { code?: string }).code === 'ECONNREFUSED'
	);
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeError(e: unknown): string {
	if (e instanceof Error) {
		return e.message;
	}
	return String(e);
}
