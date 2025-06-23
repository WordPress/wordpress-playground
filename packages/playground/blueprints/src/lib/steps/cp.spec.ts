import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { cp } from './cp';
import { loadNodeRuntime } from '@php-wasm/node';
import { logger } from '@php-wasm/logger';
import { vi } from 'vitest';

const docroot = '/php';
describe('Blueprint step cp()', () => {
	let php: PHP;
	let loggerErrorSpy: any;

	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
		php.mkdir(docroot);
		loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		loggerErrorSpy.mockRestore();
	});

	it('should copy a file', async () => {
		php.writeFile(`${docroot}/index.php`, `<?php echo 'Hello World';`);
		await cp(php, {
			fromPath: `${docroot}/index.php`,
			toPath: `${docroot}/index2.php`,
		});

		expect(php.fileExists(`${docroot}/index.php`)).toBe(true);
		expect(php.fileExists(`${docroot}/index2.php`)).toBe(true);
	});

	it('should fail when the source file does not exist', async () => {
		await expect(
			cp(php, {
				fromPath: `${docroot}/index.php`,
				toPath: `${docroot}/index2.php`,
			})
		).rejects.toThrow(/There is no such file or directory/);
	});

	it('should fail when the source file is a directory', async () => {
		php.mkdir(`${docroot}/dir`);
		await expect(
			cp(php, {
				fromPath: `${docroot}/dir`,
				toPath: `${docroot}/index2.php`,
			})
		).rejects.toThrow(/There is a directory under that path/);
	});

	it('should overwrite the target file', async () => {
		php.writeFile(`${docroot}/index.php`, `<?php echo 'Hello World';`);
		php.writeFile(`${docroot}/index2.php`, `<?php echo 'Goodbye World';`);
		await cp(php, {
			fromPath: `${docroot}/index.php`,
			toPath: `${docroot}/index2.php`,
		});

		expect(php.readFileAsText(`${docroot}/index2.php`)).toBe(
			`<?php echo 'Hello World';`
		);
	});

	it('should log error and normalize relative fromPath', async () => {
		php.writeFile(`${docroot}/source.php`, `<?php echo 'Test';`);

		await cp(php, {
			fromPath: 'php/source.php',
			toPath: `${docroot}/dest.php`,
		});

		expect(loggerErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				'The cp() step in your Blueprint refers to a relative path.'
			)
		);
		expect(php.fileExists(`${docroot}/dest.php`)).toBe(true);
	});

	it('should log error and normalize relative toPath', async () => {
		php.writeFile(`${docroot}/source.php`, `<?php echo 'Test';`);

		await cp(php, {
			fromPath: `${docroot}/source.php`,
			toPath: 'php/dest.php',
		});

		expect(loggerErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				'The cp() step in your Blueprint refers to a relative path.'
			)
		);
		expect(php.fileExists(`${docroot}/dest.php`)).toBe(true);
	});

	it('should log error and normalize both relative paths', async () => {
		php.writeFile(`${docroot}/source.php`, `<?php echo 'Test';`);

		await cp(php, {
			fromPath: 'php/source.php',
			toPath: 'php/dest.php',
		});

		expect(loggerErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				'The cp() step in your Blueprint refers to a relative path.'
			)
		);
		expect(php.fileExists(`${docroot}/dest.php`)).toBe(true);
	});

	it('should not log error for absolute paths', async () => {
		php.writeFile(`${docroot}/source.php`, `<?php echo 'Test';`);

		await cp(php, {
			fromPath: `${docroot}/source.php`,
			toPath: `${docroot}/dest.php`,
		});

		expect(loggerErrorSpy).not.toHaveBeenCalled();
		expect(php.fileExists(`${docroot}/dest.php`)).toBe(true);
	});
});
