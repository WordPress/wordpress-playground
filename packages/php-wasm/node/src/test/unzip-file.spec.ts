import {
	unzipFile,
	zipDirectory,
	RecommendedPHPVersion,
} from '@wp-playground/common';
import type { UnzipProgress } from '@wp-playground/common';
import { phpVars } from '@php-wasm/util';
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';

describe('unzipFile – concurrent calls avoid conflicts', () => {
	let php: PHP;

	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
	});

	afterEach(async () => {
		php.exit();
	});

	it('handles two parallel unzips with File inputs without conflicts', async () => {
		// Prepare two distinct source directories
		php.mkdir('/src1');
		php.writeFile('/src1/a.txt', 'one');
		php.mkdir('/src2');
		php.writeFile('/src2/b.txt', 'two');

		// Create two zip archives using the same PHP instance
		const zip1 = await zipDirectory(php, '/src1');
		const zip2 = await zipDirectory(php, '/src2');

		// Wrap buffers as Files to exercise the random tmp zip path code path
		const file1 = new File([zip1 as any], 'src1.zip');
		const file2 = new File([zip2 as any], 'src2.zip');

		// Run two unzips in parallel – should not conflict
		await Promise.all([
			unzipFile(php, file1, '/dst1'),
			unzipFile(php, file2, '/dst2'),
		]);

		// Verify extraction results are correct and isolated
		expect(await php.readFileAsText('/dst1/a.txt')).toBe('one');
		expect(php.isFile('/dst1/b.txt')).toBe(false);
		expect(await php.readFileAsText('/dst2/b.txt')).toBe('two');
		expect(php.isFile('/dst2/a.txt')).toBe(false);

		// Ensure there are no leftover temporary zip files in /tmp
		const tmpFiles = php.listFiles('/tmp');
		const leftoverZips = tmpFiles.filter((f) => f.endsWith('.zip'));
		expect(leftoverZips).toHaveLength(0);
	});

	it('extracts normalized ZIP entry names inside the target directory', async () => {
		const zip = await createZipBuffer(php, {
			'safe.txt': 'safe',
			'../escape.txt': 'escape',
		});

		await unzipFile(php, new File([zip], 'normalized.zip'), '/dst');

		expect(php.fileExists('/escape.txt')).toBe(false);
		expect(php.readFileAsText('/dst/escape.txt')).toBe('escape');
		expect(php.readFileAsText('/dst/safe.txt')).toBe('safe');
		const tmpFiles = php.listFiles('/tmp');
		const leftoverZips = tmpFiles.filter((f) => f.endsWith('.zip'));
		expect(leftoverZips).toHaveLength(0);
	});

	it('extracts leading-slash entries inside the target directory', async () => {
		const zip = await createZipBuffer(php, {
			'/absolute.txt': 'absolute',
		});

		await unzipFile(php, new File([zip], 'leading-slash.zip'), '/dst');

		expect(php.fileExists('/absolute.txt')).toBe(false);
		expect(php.readFileAsText('/dst/absolute.txt')).toBe('absolute');
	});

	it('keeps normalized entries inside the target while reporting progress', async () => {
		const zip = await createZipBuffer(php, {
			'../escape.txt': 'escape',
			'/absolute.txt': 'absolute',
		});

		await unzipFile(
			php,
			new File([zip], 'normalized-progress.zip'),
			'/dst',
			true,
			() => {}
		);

		expect(php.fileExists('/escape.txt')).toBe(false);
		expect(php.fileExists('/absolute.txt')).toBe(false);
		expect(php.readFileAsText('/dst/escape.txt')).toBe('escape');
		expect(php.readFileAsText('/dst/absolute.txt')).toBe('absolute');
	});

	it('preserves existing files when overwriteFiles is false', async () => {
		php.mkdir('/dst');
		php.writeFile('/dst/existing.txt', 'old');
		const zip = await createZipBuffer(php, {
			'existing.txt': 'new',
			'fresh.txt': 'fresh',
		});

		await unzipFile(
			php,
			new File([zip], 'no-overwrite.zip'),
			'/dst',
			false
		);

		expect(php.readFileAsText('/dst/existing.txt')).toBe('old');
		expect(php.readFileAsText('/dst/fresh.txt')).toBe('fresh');
	});

	it('reports progress after every 100 files', async () => {
		const zip = await createZipBufferWithFileSizes(
			php,
			new Array(201).fill(1)
		);
		const updates: UnzipProgress[] = [];

		await unzipFile(
			php,
			new File([zip], 'many-files.zip'),
			'/dst',
			true,
			(progress) => updates.push(progress)
		);

		expect(updates.map(({ filesProcessed }) => filesProcessed)).toEqual([
			100, 200, 201,
		]);
		expect(updates.at(-1)).toEqual({
			filesProcessed: 201,
			totalFiles: 201,
			uncompressedBytesProcessed: 201,
			totalUncompressedBytes: 201,
		});
		expect(php.readFileAsText('/dst/file-200.txt')).toBe('x');
	});

	it('reports progress after every 400 KiB of uncompressed data', async () => {
		const zip = await createZipBufferWithFileSizes(
			php,
			new Array(5).fill(200 * 1024)
		);
		const processedBytes: number[] = [];

		await unzipFile(
			php,
			new File([zip], 'large-files.zip'),
			'/dst',
			true,
			({ uncompressedBytesProcessed }) =>
				processedBytes.push(uncompressedBytesProcessed)
		);

		expect(processedBytes).toEqual([400 * 1024, 800 * 1024, 1000 * 1024]);
	});

	it('reports progress on PHP 5.2', async () => {
		const php52 = new PHP(await loadNodeRuntime('5.2'));
		try {
			const zip = await createZipBufferWithFileSizes(php52, [400 * 1024]);
			const updates: UnzipProgress[] = [];

			await unzipFile(
				php52,
				new File([zip], 'php-52.zip'),
				'/dst-php-52',
				true,
				(progress) => updates.push(progress)
			);

			expect(updates).toHaveLength(1);
			expect(updates[0].uncompressedBytesProcessed).toBe(400 * 1024);
			expect(php52.fileExists('/dst-php-52/file-0.txt')).toBe(true);
		} finally {
			php52.exit();
		}
	});
});

/**
 * Creates ZIP fixtures with exact entry names, including unsafe paths.
 *
 * `zipDirectory()` can only archive files that already exist in the VFS, so it
 * cannot create entries such as `../escape.txt` needed for extraction tests.
 */
async function createZipBuffer(php: PHP, entries: Record<string, string>) {
	const zipPath = `/tmp/source-${Math.random()}.zip`;
	const js = phpVars({ entries, zipPath });
	await php.run({
		code: `<?php
		$entries = ${js.entries};
		$zip = new ZipArchive;
		$res = $zip->open(${js.zipPath}, ZipArchive::CREATE);
		if ($res !== TRUE) {
			throw new Exception('Failed to create ZIP: ' . $res);
		}
		foreach ($entries as $name => $contents) {
			$zip->addFromString($name, $contents);
		}
		$zip->close();
		`,
	});
	const zip = await php.readFileAsBuffer(zipPath);
	await php.unlink(zipPath);
	return zip;
}

async function createZipBufferWithFileSizes(php: PHP, fileSizes: number[]) {
	const zipPath = `/tmp/source-${Math.random()}.zip`;
	const js = phpVars({ fileSizes, zipPath });
	await php.run({
		code: `<?php
		$fileSizes = ${js.fileSizes};
		$zip = new ZipArchive;
		$res = $zip->open(${js.zipPath}, ZipArchive::CREATE);
		if ($res !== TRUE) {
			throw new Exception('Failed to create ZIP: ' . $res);
		}
		foreach ($fileSizes as $index => $size) {
			$zip->addFromString("file-$index.txt", str_repeat('x', $size));
		}
		$zip->close();
		`,
	});
	const zip = await php.readFileAsBuffer(zipPath);
	await php.unlink(zipPath);
	return zip;
}
