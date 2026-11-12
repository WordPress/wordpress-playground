import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import type { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import type OsModule from 'os';
import { CACHE_FOLDER, cachedDownload } from '../src/blueprints-v1/download';

vi.mock('os', async (importOriginal) => {
	const actual = await importOriginal<{ default: typeof OsModule }>();
	const { mkdtempSync } = await import('fs');
	const home = mkdtempSync(
		(await import('path')).join(actual.default.tmpdir(), 'download-spec-')
	);
	return { ...actual, default: { ...actual.default, homedir: () => home } };
});

const monitor = {
	monitorFetch: (response: Promise<Response>) => response,
} as unknown as EmscriptenDownloadMonitor;

function stubSlowFetch(chunks: string[]) {
	vi.stubGlobal('fetch', async () => {
		let index = 0;
		const stream = new ReadableStream<Uint8Array>({
			async pull(controller) {
				await new Promise((resolve) => setTimeout(resolve, 5));
				if (index === chunks.length) {
					controller.close();
					return;
				}
				controller.enqueue(new TextEncoder().encode(chunks[index++]));
			},
		});
		return new Response(stream);
	});
}

describe('cachedDownload', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		fs.emptyDirSync(CACHE_FOLDER);
	});

	it('completes concurrent downloads of the same cache key', async () => {
		stubSlowFetch(['foo', 'bar', 'baz']);

		const files = await Promise.all([
			cachedDownload('https://example.com/foo.zip', 'foo.zip', monitor),
			cachedDownload('https://example.com/foo.zip', 'foo.zip', monitor),
		]);

		for (const file of files) {
			expect(await file.text()).toBe('foobarbaz');
		}
		expect(fs.readdirSync(CACHE_FOLDER)).toEqual(['foo.zip']);
	});

	it('deletes the temp file when the rename fails onto an existing file', async () => {
		stubSlowFetch(['qux']);
		const localPath = path.join(CACHE_FOLDER, 'qux.zip');
		vi.spyOn(fs, 'renameSync').mockImplementation(() => {
			fs.writeFileSync(localPath, 'qux');
			throw new Error('EPERM');
		});

		const file = await cachedDownload(
			'https://example.com/qux.zip',
			'qux.zip',
			monitor
		);

		expect(await file.text()).toBe('qux');
		expect(fs.readdirSync(CACHE_FOLDER)).toEqual(['qux.zip']);
	});

	it('rejects when the rename fails and no file exists', async () => {
		stubSlowFetch(['quux']);
		vi.spyOn(fs, 'renameSync').mockImplementation(() => {
			throw new Error('EACCES');
		});

		await expect(
			cachedDownload('https://example.com/quux.zip', 'quux.zip', monitor)
		).rejects.toThrow('EACCES');
	});
});
