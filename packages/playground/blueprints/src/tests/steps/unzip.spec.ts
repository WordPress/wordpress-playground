import { PHP, PHPRequestHandler } from '@php-wasm/universal';
import { RecommendedPHPVersion, unzipFile } from '@wp-playground/common';
import { loadNodeRuntime } from '@php-wasm/node';
import { vi } from 'vitest';

describe('Blueprint step unzip', () => {
	let php: PHP;
	let handler: PHPRequestHandler;

	beforeEach(async () => {
		handler = new PHPRequestHandler({
			phpFactory: async () =>
				new PHP(await loadNodeRuntime(RecommendedPHPVersion)),
			documentRoot: '/wordpress',
		});
		php = await handler.getPrimaryPhp();
		php.mkdir('/wordpress');
	});

	afterEach(async () => {
		php.exit();
		await handler[Symbol.asyncDispose]();
	});

	it('rejects ZIP entries that escape the extraction directory', async () => {
		const zipPath = '/tmp/unsafe.zip';
		await php.run({
			code: `<?php
$zip = new ZipArchive();
$zip->open('${zipPath}', ZipArchive::CREATE);
$zip->addFromString('../escaped.txt', 'bad');
$zip->close();
`,
		});

		await expect(
			unzipFile(
				php,
				new File([php.readFileAsBuffer(zipPath)], 'unsafe.zip'),
				'/wordpress/extracted'
			)
		).rejects.toThrow(/Unsafe ZIP entry path/);

		const leftoverTempZips = php
			.listFiles('/tmp')
			.filter((file) => /^file-.*\.zip$/.test(file));
		expect(leftoverTempZips).toEqual([]);
		expect(php.fileExists('/wordpress/escaped.txt')).toBe(false);
		expect(php.fileExists('/escaped.txt')).toBe(false);
	});

	it('does not partially extract before rejecting unsafe ZIP entries', async () => {
		const zipPath = '/tmp/partially-unsafe.zip';
		await php.run({
			code: `<?php
$zip = new ZipArchive();
$zip->open('${zipPath}', ZipArchive::CREATE);
$zip->addFromString('safe.txt', 'safe');
$zip->addFromString('../escaped.txt', 'bad');
$zip->close();
`,
		});

		await expect(
			unzipFile(
				php,
				new File([php.readFileAsBuffer(zipPath)], 'unsafe.zip'),
				'/wordpress/extracted'
			)
		).rejects.toThrow(/Unsafe ZIP entry path/);

		expect(php.fileExists('/wordpress/extracted/safe.txt')).toBe(false);
		expect(php.fileExists('/wordpress/escaped.txt')).toBe(false);
		expect(php.fileExists('/escaped.txt')).toBe(false);
	});

	it('cleans temporary File uploads when writing the temporary ZIP fails', async () => {
		const originalWriteFile = php.writeFile.bind(php);
		const writeFileSpy = vi
			.spyOn(php, 'writeFile')
			.mockImplementation(async (path, data) => {
				await originalWriteFile(path, data);
				throw new Error('Simulated write failure');
			});

		try {
			await expect(
				unzipFile(
					php,
					new File([new Uint8Array([1])], 'partial.zip'),
					'/wordpress/extracted'
				)
			).rejects.toThrow('Simulated write failure');

			const leftoverTempZips = php
				.listFiles('/tmp')
				.filter((file) => /^file-.*\.zip$/.test(file));
			expect(leftoverTempZips).toEqual([]);
		} finally {
			writeFileSpy.mockRestore();
		}
	});
});
