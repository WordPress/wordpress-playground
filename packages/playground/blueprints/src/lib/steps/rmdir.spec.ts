import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { rmdir } from './rmdir';
import { loadNodeRuntime } from '@php-wasm/node';
import { logger } from '@php-wasm/logger';
import { vi } from 'vitest';

const docroot = '/php';
describe('Blueprint step rmdir()', () => {
	let php: PHP;
	let loggerErrorSpy: any;

	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
		php.mkdir(docroot);
		loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		loggerErrorSpy.mockRestore();
		php.exit();
	});

	it('should remove a directory', async () => {
		php.mkdir(`${docroot}/testdir`);
		expect(php.isDir(`${docroot}/testdir`)).toBe(true);

		await rmdir(php, {
			path: `${docroot}/testdir`,
		});

		expect(php.isDir(`${docroot}/testdir`)).toBe(false);
	});

	it('should fail when the directory does not exist', async () => {
		await expect(
			rmdir(php, {
				path: `${docroot}/nonexistent`,
			})
		).rejects.toThrow();
	});

	it('should log error and normalize relative path', async () => {
		php.mkdir(`${docroot}/testdir`);

		await rmdir(php, {
			path: 'php/testdir',
		});

		expect(loggerErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				'The rmdir() step in your Blueprint refers to a relative path.'
			)
		);
		expect(php.isDir(`${docroot}/testdir`)).toBe(false);
	});

	it('should not log error for absolute paths', async () => {
		php.mkdir(`${docroot}/testdir`);

		await rmdir(php, {
			path: `${docroot}/testdir`,
		});

		expect(loggerErrorSpy).not.toHaveBeenCalled();
		expect(php.isDir(`${docroot}/testdir`)).toBe(false);
	});
});
