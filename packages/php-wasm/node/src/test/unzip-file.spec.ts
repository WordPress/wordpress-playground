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
});
