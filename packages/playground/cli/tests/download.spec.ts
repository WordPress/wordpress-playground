import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import type * as OsModule from 'os';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { CACHE_FOLDER, cachedDownload } from '../src/blueprints-v1/download';

vi.mock('os', async (importOriginal) => {
	const os = await importOriginal<typeof OsModule>();
	const home = fs.mkdtempSync(path.join(os.tmpdir(), 'playground-cache-'));
	const homedir = () => home;
	return { ...os, default: { ...os, homedir }, homedir };
});

describe('cachedDownload', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	afterAll(() => {
		fs.rmSync(path.dirname(CACHE_FOLDER), { recursive: true, force: true });
	});

	test.each([
		'../outside.zip',
		'nested/outside.zip',
		'nested\\outside.zip',
		'/tmp/outside.zip',
		'C:outside.zip',
		'.',
		'..',
		'',
	])('rejects the cache file name %j', async (cacheKey) => {
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);

		await expect(
			cachedDownload(
				'https://example.com/wordpress.zip',
				cacheKey,
				new EmscriptenDownloadMonitor()
			)
		).rejects.toThrow('Invalid cache file name');
		expect(fetch).not.toHaveBeenCalled();
	});

	test.each(['6.9-RC1.zip', `custom-${'a'.repeat(64)}.zip`])(
		'downloads and caches %s',
		async (cacheKey) => {
			vi.stubGlobal(
				'fetch',
				vi.fn(async () => new Response('WordPress'))
			);

			const file = await cachedDownload(
				'https://example.com/wordpress.zip',
				cacheKey,
				new EmscriptenDownloadMonitor()
			);

			expect(await file.text()).toBe('WordPress');
			expect(
				fs.readFileSync(path.join(CACHE_FOLDER, cacheKey), 'utf8')
			).toBe('WordPress');
		}
	);

	test('does not cache an HTTP error response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response('Release not found.', {
						status: 404,
						statusText: 'Not Found',
					})
			)
		);

		await expect(
			cachedDownload(
				'https://example.com/missing.zip',
				'missing.zip',
				new EmscriptenDownloadMonitor()
			)
		).rejects.toThrow('404');
		expect(fs.existsSync(path.join(CACHE_FOLDER, 'missing.zip'))).toBe(
			false
		);
	});
});
