import { createHash } from 'node:crypto';
import { createServer, type RequestListener, type Server } from 'node:http';
import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	utimes,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { NativeCLIErrorCode } from '../src/errors.js';
import { ensureNativeHost } from '../src/host.js';
import type { NativeHostAsset, NativeHostManifest } from '../src/manifest.js';

const target = 'linux-x64-gnu' as const;
const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
	for (const callback of cleanup.splice(0).reverse()) await callback();
});

describe('native host acquisition', () => {
	it('requires an explicit base URL', async () => {
		const { manifest } = fixture();
		const cacheDir = await temporaryCache();
		const previous = process.env['WP_PLAYGROUND_NATIVE_HOST_BASE_URL'];
		delete process.env['WP_PLAYGROUND_NATIVE_HOST_BASE_URL'];
		try {
			await expect(
				ensureNativeHost({ manifest, target, cacheDir })
			).rejects.toMatchObject({
				code: NativeCLIErrorCode.Configuration,
			});
		} finally {
			if (previous === undefined) {
				delete process.env['WP_PLAYGROUND_NATIVE_HOST_BASE_URL'];
			} else {
				process.env['WP_PLAYGROUND_NATIVE_HOST_BASE_URL'] = previous;
			}
		}
	});

	it('verifies, caches, and repairs a corrupt cached host', async () => {
		const data = fixture();
		let requests = 0;
		const baseUrl = await serve((_request, response) => {
			requests++;
			response.writeHead(200, {
				'content-length': data.compressed.length,
			});
			response.end(data.compressed);
		});
		const cacheDir = await temporaryCache();
		const options = { manifest: data.manifest, target, baseUrl, cacheDir };

		const first = await ensureNativeHost(options);
		expect(await readFile(first.executablePath)).toEqual(data.binary);
		await ensureNativeHost(options);
		expect(requests).toBe(1);

		await writeFile(first.executablePath, 'corrupt');
		const repaired = await ensureNativeHost(options);
		expect(await readFile(repaired.executablePath)).toEqual(data.binary);
		expect(requests).toBe(2);
	});

	it('rejects a compressed SHA-256 mismatch', async () => {
		const data = fixture({ compressedSha256: '0'.repeat(64) });
		const baseUrl = await serve((_request, response) => {
			response.end(data.compressed);
		});
		await expect(
			ensureNativeHost({
				manifest: data.manifest,
				target,
				baseUrl,
				cacheDir: await temporaryCache(),
			})
		).rejects.toMatchObject({ code: NativeCLIErrorCode.Integrity });
	});

	it.each([
		{
			name: 'declared compressed size mismatch',
			body: (compressed: Buffer) => compressed,
			contentLength: (compressed: Buffer) => compressed.length + 1,
		},
		{
			name: 'truncated compressed response',
			body: (compressed: Buffer) => compressed.subarray(0, -1),
		},
		{
			name: 'oversized compressed response',
			body: (compressed: Buffer) =>
				Buffer.concat([compressed, Buffer.from([0])]),
		},
	])('rejects $name', async ({ body, contentLength }) => {
		const data = fixture();
		const baseUrl = await serve((_request, response) => {
			const headers = contentLength
				? { 'content-length': contentLength(data.compressed) }
				: undefined;
			if (headers) response.writeHead(200, headers);
			else response.writeHead(200);
			response.end(body(data.compressed));
		});
		await expect(
			ensureNativeHost({
				manifest: data.manifest,
				target,
				baseUrl,
				cacheDir: await temporaryCache(),
			})
		).rejects.toMatchObject({ code: NativeCLIErrorCode.Integrity });
	});

	it('coordinates concurrent first acquisition into one request', async () => {
		const data = fixture();
		let requests = 0;
		const baseUrl = await serve((_request, response) => {
			requests++;
			setTimeout(() => {
				response.writeHead(200, {
					'content-length': data.compressed.length,
				});
				response.end(data.compressed);
			}, 75);
		});
		const options = {
			manifest: data.manifest,
			target,
			baseUrl,
			cacheDir: await temporaryCache(),
		};

		const installations = await Promise.all(
			Array.from({ length: 8 }, () => ensureNativeHost(options))
		);
		expect(
			new Set(installations.map(({ executablePath }) => executablePath))
		).toHaveLength(1);
		expect(requests).toBe(1);
	});

	it('rejects an insecure non-loopback redirect before following it', async () => {
		const data = fixture();
		let redirectedRequests = 0;
		let redirectLocation = '';
		const baseUrl = await serve(
			(request, response) => {
				if (request.url === '/payload.gz') {
					redirectedRequests++;
					response.end(data.compressed);
					return;
				}
				response.writeHead(302, { location: redirectLocation });
				response.end();
			},
			(server) => {
				const address = server.address();
				if (!address || typeof address === 'string') {
					throw new Error('missing test server address');
				}
				redirectLocation = `http://0.0.0.0:${address.port}/payload.gz`;
			}
		);

		await expect(
			ensureNativeHost({
				manifest: data.manifest,
				target,
				baseUrl,
				cacheDir: await temporaryCache(),
			})
		).rejects.toMatchObject({
			code: NativeCLIErrorCode.Configuration,
		});
		expect(redirectedRequests).toBe(0);
	});

	it('recovers a malformed lock after a short stale grace period', async () => {
		const data = fixture();
		const cacheDir = await temporaryCache();
		const installDir = join(
			cacheDir,
			data.manifest.hostVersion,
			target,
			data.asset.sha256
		);
		const lockPath = `${installDir}.lock`;
		await mkdir(dirname(lockPath), { recursive: true });
		await writeFile(lockPath, '{not-json');
		const malformedButNotTenMinutesOld = new Date(Date.now() - 2_000);
		await utimes(
			lockPath,
			malformedButNotTenMinutesOld,
			malformedButNotTenMinutesOld
		);
		const baseUrl = await serve((_request, response) => {
			response.end(data.compressed);
		});

		const installation = await ensureNativeHost({
			manifest: data.manifest,
			target,
			baseUrl,
			cacheDir,
		});
		expect(await readFile(installation.executablePath)).toEqual(
			data.binary
		);
	});
});

function fixture(overrides: Partial<NativeHostAsset> = {}): {
	binary: Buffer;
	compressed: Buffer;
	asset: NativeHostAsset;
	manifest: NativeHostManifest;
} {
	const binary = Buffer.from('#!/bin/sh\nexit 0\n');
	const compressed = gzipSync(binary);
	const asset: NativeHostAsset = {
		path: 'host.gz',
		compressedSize: compressed.length,
		compressedSha256: sha(compressed),
		size: binary.length,
		sha256: sha(binary),
		...overrides,
	};
	return {
		binary,
		compressed,
		asset,
		manifest: {
			schemaVersion: 1,
			protocolVersion: 1,
			hostVersion: 'test',
			targets: { [target]: asset },
		},
	};
}

async function temporaryCache(): Promise<string> {
	const cacheDir = await mkdtemp(join(tmpdir(), 'native-host-test-'));
	cleanup.push(() => rm(cacheDir, { recursive: true, force: true }));
	return cacheDir;
}

async function serve(
	handler: RequestListener,
	afterListen?: (server: Server) => void
): Promise<string> {
	const server = createServer(handler);
	await new Promise<void>((resolvePromise, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			server.off('error', reject);
			resolvePromise();
		});
	});
	cleanup.push(
		() =>
			new Promise((resolvePromise) =>
				server.close(() => resolvePromise())
			)
	);
	afterListen?.(server);
	const address = server.address();
	if (!address || typeof address === 'string') {
		throw new Error('missing test server address');
	}
	return `http://127.0.0.1:${address.port}`;
}

function sha(value: Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}
