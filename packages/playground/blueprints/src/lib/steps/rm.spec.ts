import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { rm } from './rm';
import { loadNodeRuntime } from '@php-wasm/node';
import { logger } from '@php-wasm/logger';
import { vi } from 'vitest';

const docroot = '/php';
describe('Blueprint step rm()', () => {
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

	it('should remove a file', async () => {
		php.writeFile(`${docroot}/index.php`, `<?php echo 'Hello World';`);
		await rm(php, {
			path: `${docroot}/index.php`,
		});
		expect(php.fileExists(`${docroot}/index.php`)).toBe(false);
	});

	it('should fail when the file does not exist', async () => {
		await expect(
			rm(php, {
				path: `${docroot}/index.php`,
			})
		).rejects.toThrow(/There is no such file or directory/);
	});

	it('should fail when the file is a directory', async () => {
		php.mkdir(`${docroot}/dir`);
		await expect(
			rm(php, {
				path: `${docroot}/dir`,
			})
		).rejects.toThrow(/There is a directory under that path./);
	});

	it('should log error and normalize relative path', async () => {
		php.writeFile(`${docroot}/test.php`, `<?php echo 'Test';`);

		await rm(php, {
			path: 'php/test.php',
		});

		expect(loggerErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				'The rm() step in your Blueprint refers to a relative path.'
			)
		);
		expect(php.fileExists(`${docroot}/test.php`)).toBe(false);
	});

	it('should not log error for absolute paths', async () => {
		php.writeFile(`${docroot}/test.php`, `<?php echo 'Test';`);

		await rm(php, {
			path: `${docroot}/test.php`,
		});

		expect(loggerErrorSpy).not.toHaveBeenCalled();
		expect(php.fileExists(`${docroot}/test.php`)).toBe(false);
	});
});
