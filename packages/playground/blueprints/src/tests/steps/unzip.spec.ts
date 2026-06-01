import { PHP, PHPRequestHandler } from '@php-wasm/universal';
import { RecommendedPHPVersion, unzipFile } from '@wp-playground/common';
import { loadNodeRuntime } from '@php-wasm/node';

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

		expect(php.fileExists('/wordpress/escaped.txt')).toBe(false);
		expect(php.fileExists('/escaped.txt')).toBe(false);
	});
});
