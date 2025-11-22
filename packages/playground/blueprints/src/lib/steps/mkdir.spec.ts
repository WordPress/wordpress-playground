import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { mkdir } from './mkdir';
import { loadNodeRuntime } from '@php-wasm/node';
import { logger } from '@php-wasm/logger';
import { vi } from 'vitest';

describe('Blueprint step mkdir', () => {
	let php: PHP;
	let loggerErrorSpy: any;

	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
		loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		loggerErrorSpy.mockRestore();
		php.exit();
	});

	it('should create a directory', async () => {
		const directoryToCreate = '/php/dir';
		await mkdir(php, {
			path: directoryToCreate,
		});
		expect(php.isDir(directoryToCreate)).toBe(true);
	});

	it('should create a directory recursively', async () => {
		const directoryToCreate = '/php/dir/subDir';
		await mkdir(php, {
			path: directoryToCreate,
		});
		expect(php.isDir(directoryToCreate)).toBe(true);
	});

	it('should do nothing when asked to create a directory that is allready there', async () => {
		const existingDirectory = '/php/dir';
		php.mkdir(existingDirectory);

		const existingFile = '/php/dir/index.php';
		php.writeFile(existingFile, `<?php echo 'Hello World';`);

		mkdir(php, {
			path: existingDirectory,
		});

		expect(php.readFileAsText(existingFile)).toBe(
			`<?php echo 'Hello World';`
		);
	});

	it('should log error when using relative path', async () => {
		const relativePath = 'php/newdir';

		await mkdir(php, {
			path: relativePath,
		});

		expect(loggerErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				'The mkdir() step in your Blueprint refers to a relative path.'
			)
		);
		expect(php.isDir('/php/newdir')).toBe(true);
	});

	it('should not log error for absolute paths', async () => {
		const absolutePath = '/php/newdir';

		await mkdir(php, {
			path: absolutePath,
		});

		expect(loggerErrorSpy).not.toHaveBeenCalled();
		expect(php.isDir(absolutePath)).toBe(true);
	});
});
