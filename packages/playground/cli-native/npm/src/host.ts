import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import {
	chmod,
	mkdir,
	open,
	readFile,
	rename,
	rm,
	stat,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { NativeCLIError, NativeCLIErrorCode } from './errors.js';
import {
	installedAssetRoot,
	loadNativeHostManifest,
	nativeTargets,
	resolveNativeTarget,
	validateNativeHostManifest,
	type NativeHostAsset,
	type NativeHostManifest,
	type NativeTarget,
} from './manifest.js';

const DEFAULT_TIMEOUT_MS = 60_000;
const LOCK_STALE_MS = 10 * 60_000;
const MALFORMED_LOCK_GRACE_MS = 1_000;
const MAX_REDIRECTS = 20;

export interface EnsureNativeHostOptions {
	manifest?: NativeHostManifest;
	target?: NativeTarget;
	baseUrl?: string;
	cacheDir?: string;
	timeoutMs?: number;
	signal?: AbortSignal;
}

export interface NativeHostInstallation {
	executablePath: string;
	assetRoot: string;
	target: NativeTarget;
	hostVersion: string;
	protocolVersion: number;
}

export async function ensureNativeHost(
	options: EnsureNativeHostOptions = {}
): Promise<NativeHostInstallation> {
	const manifest = validateNativeHostManifest(
		options.manifest ?? (await loadNativeHostManifest())
	);
	const target = options.target ?? resolveNativeTarget();
	if (!(nativeTargets as readonly string[]).includes(target)) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Unsupported,
			`Unsupported native CLI target: ${String(target)}.`
		);
	}
	const asset = manifest.targets[target];
	if (!asset) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Unsupported,
			`The native host manifest has no build for ${target}.`
		);
	}
	const baseUrl =
		options.baseUrl ?? process.env['WP_PLAYGROUND_NATIVE_HOST_BASE_URL'];
	if (!baseUrl) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Configuration,
			'WP_PLAYGROUND_NATIVE_HOST_BASE_URL is required because this private package has no public native-host download location.'
		);
	}
	const url = resolveAssetUrl(baseUrl, asset.path);
	const cacheRoot = resolve(
		options.cacheDir ??
			process.env['WP_PLAYGROUND_NATIVE_CACHE_DIR'] ??
			join(homedir(), '.wordpress-playground', 'native')
	);
	const installDir = join(
		cacheRoot,
		manifest.hostVersion,
		target,
		asset.sha256
	);
	const executablePath = join(
		installDir,
		process.platform === 'win32'
			? 'wp-playground-native.exe'
			: 'wp-playground-native'
	);

	if (!(await validFile(executablePath, asset.size, asset.sha256))) {
		await withAcquisitionLock(`${installDir}.lock`, async () => {
			if (await validFile(executablePath, asset.size, asset.sha256))
				return;
			await rm(installDir, { recursive: true, force: true });
			await downloadAndInstall(
				url,
				installDir,
				executablePath,
				asset,
				options
			);
		});
	}

	return {
		executablePath,
		assetRoot: installedAssetRoot(),
		target,
		hostVersion: manifest.hostVersion,
		protocolVersion: manifest.protocolVersion,
	};
}

function resolveAssetUrl(baseUrl: string, assetPath: string): URL {
	let url: URL;
	try {
		url = new URL(
			assetPath,
			baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
		);
	} catch (cause) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Configuration,
			`Invalid WP_PLAYGROUND_NATIVE_HOST_BASE_URL: ${baseUrl}.`,
			{ cause }
		);
	}
	assertSecureAssetUrl(url);
	return url;
}

function assertSecureAssetUrl(url: URL): void {
	if (url.protocol !== 'https:' && !isLoopbackHttp(url)) {
		throw new NativeCLIError(
			NativeCLIErrorCode.Configuration,
			`Native hosts must be downloaded over HTTPS; HTTP is accepted only for a loopback test server. Rejected ${url}.`
		);
	}
}

function isLoopbackHttp(url: URL): boolean {
	return (
		url.protocol === 'http:' &&
		['127.0.0.1', '::1', '[::1]', 'localhost'].includes(url.hostname)
	);
}

async function downloadAndInstall(
	url: URL,
	installDir: string,
	executablePath: string,
	asset: NativeHostAsset,
	options: EnsureNativeHostOptions
): Promise<void> {
	const parent = dirname(installDir);
	await mkdir(parent, { recursive: true });
	const stageDir = `${installDir}.partial-${process.pid}-${Date.now()}`;
	const compressedPath = join(stageDir, 'host.gz');
	const stagedExecutable = join(stageDir, 'wp-playground-native');
	await mkdir(stageDir, { recursive: true, mode: 0o700 });

	const abortController = new AbortController();
	const timeout = setTimeout(
		() =>
			abortController.abort(new Error('Native host download timed out.')),
		options.timeoutMs ?? DEFAULT_TIMEOUT_MS
	);
	const forwardAbort = () => abortController.abort(options.signal?.reason);
	if (options.signal?.aborted) forwardAbort();
	else
		options.signal?.addEventListener('abort', forwardAbort, { once: true });
	try {
		let response: Response;
		try {
			response = await fetchFollowingSecureRedirects(
				url,
				abortController.signal
			);
		} catch (cause) {
			if (cause instanceof NativeCLIError) throw cause;
			throw new NativeCLIError(
				NativeCLIErrorCode.Download,
				`Failed to download the native host from ${url}.`,
				{ cause }
			);
		}
		if (!response.ok || !response.body) {
			throw new NativeCLIError(
				NativeCLIErrorCode.Download,
				`Native host download failed with HTTP ${response.status} from ${url}.`
			);
		}
		const contentLengthHeader = response.headers.get('content-length');
		const contentLength = Number(contentLengthHeader);
		if (
			contentLengthHeader !== null &&
			Number.isFinite(contentLength) &&
			contentLength !== asset.compressedSize
		) {
			throw integrityError(
				'compressed size',
				asset.compressedSize,
				contentLength
			);
		}
		const compressedHash = createHash('sha256');
		let compressedBytes = 0;
		const limiter = new Transform({
			transform(chunk: Buffer, _encoding, callback) {
				compressedBytes += chunk.length;
				if (compressedBytes > asset.compressedSize) {
					callback(
						integrityError(
							'compressed size',
							asset.compressedSize,
							compressedBytes
						)
					);
					return;
				}
				compressedHash.update(chunk);
				callback(null, chunk);
			},
		});
		await pipeline(
			Readable.fromWeb(response.body as never),
			limiter,
			createWriteStream(compressedPath, { mode: 0o600 })
		);
		if (compressedBytes !== asset.compressedSize) {
			throw integrityError(
				'compressed size',
				asset.compressedSize,
				compressedBytes
			);
		}
		const compressedDigest = compressedHash.digest('hex');
		if (compressedDigest !== asset.compressedSha256) {
			throw integrityError(
				'compressed SHA-256',
				asset.compressedSha256,
				compressedDigest
			);
		}

		const hash = createHash('sha256');
		let bytes = 0;
		const outputLimiter = new Transform({
			transform(chunk: Buffer, _encoding, callback) {
				bytes += chunk.length;
				if (bytes > asset.size) {
					callback(
						integrityError('decompressed size', asset.size, bytes)
					);
					return;
				}
				hash.update(chunk);
				callback(null, chunk);
			},
		});
		await pipeline(
			createReadStream(compressedPath),
			createGunzip(),
			outputLimiter,
			createWriteStream(stagedExecutable, { mode: 0o700 })
		);
		const digest = hash.digest('hex');
		if (bytes !== asset.size)
			throw integrityError('decompressed size', asset.size, bytes);
		if (digest !== asset.sha256)
			throw integrityError('decompressed SHA-256', asset.sha256, digest);
		if (process.platform !== 'win32') await chmod(stagedExecutable, 0o755);
		await rm(compressedPath, { force: true });
		await rename(stageDir, installDir);
		if (
			process.platform === 'win32' &&
			executablePath !== join(installDir, 'wp-playground-native')
		) {
			await rename(
				join(installDir, 'wp-playground-native'),
				executablePath
			);
		}
	} catch (cause) {
		await rm(stageDir, { recursive: true, force: true });
		throw cause;
	} finally {
		clearTimeout(timeout);
		options.signal?.removeEventListener('abort', forwardAbort);
	}
}

async function fetchFollowingSecureRedirects(
	initialUrl: URL,
	signal: AbortSignal
): Promise<Response> {
	let url = initialUrl;
	for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
		assertSecureAssetUrl(url);
		const response = await fetch(url, { signal, redirect: 'manual' });
		const responseUrl = response.url ? new URL(response.url) : url;
		try {
			assertSecureAssetUrl(responseUrl);
		} catch (cause) {
			await cancelResponseBody(response);
			throw cause;
		}
		if (!isRedirect(response.status)) return response;

		const location = response.headers.get('location');
		if (!location) return response;
		if (redirects === MAX_REDIRECTS) {
			await cancelResponseBody(response);
			throw new NativeCLIError(
				NativeCLIErrorCode.Download,
				`Native host download exceeded ${MAX_REDIRECTS} redirects.`
			);
		}
		let redirectedUrl: URL;
		try {
			redirectedUrl = new URL(location, responseUrl);
		} catch (cause) {
			await cancelResponseBody(response);
			throw new NativeCLIError(
				NativeCLIErrorCode.Download,
				`Native host download returned an invalid redirect location: ${location}.`,
				{ cause }
			);
		}
		await cancelResponseBody(response);
		assertSecureAssetUrl(redirectedUrl);
		url = redirectedUrl;
	}
	throw new NativeCLIError(
		NativeCLIErrorCode.Download,
		`Native host download exceeded ${MAX_REDIRECTS} redirects.`
	);
}

async function cancelResponseBody(response: Response): Promise<void> {
	try {
		await response.body?.cancel();
	} catch {
		// Cleanup must not hide the redirect validation error.
	}
}

function isRedirect(status: number): boolean {
	return [301, 302, 303, 307, 308].includes(status);
}

async function validFile(
	path: string,
	expectedSize: number,
	expectedHash: string
): Promise<boolean> {
	try {
		if ((await stat(path)).size !== expectedSize) return false;
		return (await sha256File(path)) === expectedHash;
	} catch {
		return false;
	}
}

async function sha256File(path: string): Promise<string> {
	const hash = createHash('sha256');
	for await (const chunk of createReadStream(path))
		hash.update(chunk as Buffer);
	return hash.digest('hex');
}

async function withAcquisitionLock<T>(
	lockPath: string,
	callback: () => Promise<T>
): Promise<T> {
	await mkdir(dirname(lockPath), { recursive: true });
	while (true) {
		try {
			const handle = await open(lockPath, 'wx', 0o600);
			await handle.writeFile(
				JSON.stringify({ pid: process.pid, createdAt: Date.now() })
			);
			await handle.close();
			break;
		} catch (cause) {
			if (!isAlreadyExists(cause)) throw cause;
			if (await lockIsStale(lockPath)) {
				await rm(lockPath, { force: true });
				continue;
			}
			await new Promise((resolvePromise) =>
				setTimeout(resolvePromise, 100)
			);
		}
	}
	try {
		return await callback();
	} finally {
		await rm(lockPath, { force: true });
	}
}

async function lockIsStale(lockPath: string): Promise<boolean> {
	let age: number;
	try {
		age = Date.now() - (await stat(lockPath)).mtimeMs;
	} catch (cause) {
		return (cause as NodeJS.ErrnoException).code === 'ENOENT';
	}
	if (age > LOCK_STALE_MS) return true;

	let pid: unknown;
	try {
		const metadata = await readFile(lockPath, 'utf8');
		pid = (JSON.parse(metadata) as { pid?: unknown }).pid;
	} catch {
		return age > MALFORMED_LOCK_GRACE_MS;
	}
	if (!Number.isInteger(pid) || (pid as number) <= 0) {
		return age > MALFORMED_LOCK_GRACE_MS;
	}
	try {
		process.kill(pid as number, 0);
		return false;
	} catch (cause) {
		return (cause as NodeJS.ErrnoException).code === 'ESRCH';
	}
}

function isAlreadyExists(cause: unknown): boolean {
	return (cause as NodeJS.ErrnoException)?.code === 'EEXIST';
}

function integrityError(
	kind: string,
	expected: string | number,
	actual: string | number
) {
	return new NativeCLIError(
		NativeCLIErrorCode.Integrity,
		`Native host ${kind} mismatch: expected ${expected}, received ${actual}.`
	);
}
