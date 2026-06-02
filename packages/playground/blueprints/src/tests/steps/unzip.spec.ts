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

	it('does not follow ZIP symlink entries outside the extraction directory', async () => {
		const zipPath = '/tmp/symlink-unsafe.zip';
		await php.mkdir('/outside');
		await php.run({
			code: `<?php
$zip = new ZipArchive();
$zip->open('${zipPath}', ZipArchive::CREATE);
$zip->addFromString('safe.txt', 'safe');
$zip->addFromString('link', '../outside');
$zip->setExternalAttributesName('link', 3, 0120777 << 16);
$zip->addFromString('link/pwn.php', 'bad');
$zip->close();
`,
		});

		await expect(
			unzipFile(
				php,
				new File([php.readFileAsBuffer(zipPath)], 'unsafe.zip'),
				'/wordpress/extracted'
			)
		).rejects.toThrow(/ZIP symlink entry/);

		expect(php.fileExists('/wordpress/extracted/safe.txt')).toBe(false);
		expect(php.fileExists('/outside/pwn.php')).toBe(false);
		expect(php.fileExists('/wordpress/outside/pwn.php')).toBe(false);
	});

	it('does not create directories through pre-existing symlink parents', async () => {
		const zipPath = '/tmp/preexisting-symlink-unsafe.zip';
		await php.mkdir('/outside');
		await php.mkdir('/wordpress/extracted');
		await php.run({
			code: `<?php
symlink('/outside', '/wordpress/extracted/link');
$zip = new ZipArchive();
$zip->open('${zipPath}', ZipArchive::CREATE);
$zip->addFromString('link/newdir/pwn.php', 'bad');
$zip->close();
`,
		});

		await expect(
			unzipFile(
				php,
				new File([php.readFileAsBuffer(zipPath)], 'unsafe.zip'),
				'/wordpress/extracted'
			)
		).rejects.toThrow(/symlink/);

		expect(php.fileExists('/outside/newdir')).toBe(false);
		expect(php.fileExists('/outside/newdir/pwn.php')).toBe(false);
	});

	it('does not create the extraction root through symlink parents', async () => {
		const zipPath = '/tmp/root-symlink-unsafe.zip';
		await php.mkdir('/outside');
		await php.run({
			code: `<?php
symlink('/outside', '/wordpress/link');
$zip = new ZipArchive();
$zip->open('${zipPath}', ZipArchive::CREATE);
$zip->addFromString('pwn.php', 'bad');
$zip->close();
`,
		});

		await expect(
			unzipFile(
				php,
				new File([php.readFileAsBuffer(zipPath)], 'unsafe.zip'),
				'/wordpress/link/extracted'
			)
		).rejects.toThrow(/symlink/);

		expect(php.fileExists('/outside/extracted')).toBe(false);
		expect(php.fileExists('/outside/extracted/pwn.php')).toBe(false);
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
