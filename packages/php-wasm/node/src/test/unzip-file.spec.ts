import {
	unzipFile,
	zipDirectory,
	RecommendedPHPVersion,
} from '@wp-playground/common';
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
		php.mkdir('/src1');
		php.writeFile('/src1/a.txt', 'one');
		php.mkdir('/src2');
		php.writeFile('/src2/b.txt', 'two');

		const zip1 = await zipDirectory(php, '/src1');
		const zip2 = await zipDirectory(php, '/src2');

		const file1 = new File([zip1 as any], 'src1.zip');
		const file2 = new File([zip2 as any], 'src2.zip');

		await Promise.all([
			unzipFile(php, file1, '/dst1'),
			unzipFile(php, file2, '/dst2'),
		]);

		expect(await php.readFileAsText('/dst1/a.txt')).toBe('one');
		expect(php.isFile('/dst1/b.txt')).toBe(false);
		expect(await php.readFileAsText('/dst2/b.txt')).toBe('two');
		expect(php.isFile('/dst2/a.txt')).toBe(false);

		const tmpFiles = php.listFiles('/tmp');
		const leftoverZips = tmpFiles.filter((f) => f.endsWith('.zip'));
		expect(leftoverZips).toHaveLength(0);
	});

	it('rejects path traversal entries before extracting anything', async () => {
		const zip = await createZipBuffer(php, {
			'safe.txt': 'safe',
			'../escape.txt': 'escape',
		});

		await expect(
			unzipFile(php, new File([zip], 'bad.zip'), '/dst')
		).rejects.toThrow('Unsafe ZIP entry name: ../escape.txt');

		expect(php.fileExists('/escape.txt')).toBe(false);
		expect(php.fileExists('/dst/safe.txt')).toBe(false);
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
});

async function createZipBuffer(php: PHP, entries: Record<string, string>) {
	const zipPath = `/tmp/source-${Math.random()}.zip`;
	const entriesJson = JSON.stringify(entries);
	await php.run({
		code: `<?php
		$entries = json_decode(${JSON.stringify(entriesJson)}, true);
		$zip = new ZipArchive;
		$res = $zip->open(${JSON.stringify(zipPath)}, ZipArchive::CREATE);
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
