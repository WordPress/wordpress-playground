import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { writeFile } from './write-file';
import { loadNodeRuntime } from '@php-wasm/node';
import { logger } from '@php-wasm/logger';
import { vi } from 'vitest';

const docroot = '/php';
describe('Blueprint step writeFile()', () => {
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

	it('should write a file with string data', async () => {
		const content = '<?php echo "Hello World";';

		await writeFile(php, {
			path: `${docroot}/test.php`,
			data: content,
		});

		expect(php.fileExists(`${docroot}/test.php`)).toBe(true);
		expect(php.readFileAsText(`${docroot}/test.php`)).toBe(content);
	});

	it('should write a file with Uint8Array data', async () => {
		const content = new TextEncoder().encode('Test content');

		await writeFile(php, {
			path: `${docroot}/test.txt`,
			data: content,
		});

		expect(php.fileExists(`${docroot}/test.txt`)).toBe(true);
		expect(php.readFileAsText(`${docroot}/test.txt`)).toBe('Test content');
	});

	it('should write a file with File data', async () => {
		const content = new File(['Test file content'], 'test.txt');

		await writeFile(php, {
			path: `${docroot}/test.txt`,
			data: content,
		});

		expect(php.fileExists(`${docroot}/test.txt`)).toBe(true);
		expect(php.readFileAsText(`${docroot}/test.txt`)).toBe(
			'Test file content'
		);
	});

	it('should log error and normalize relative path', async () => {
		const content = '<?php echo "Test";';

		await writeFile(php, {
			path: 'php/test.php',
			data: content,
		});

		expect(loggerErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				'The writeFile() step in your Blueprint refers to a relative path.'
			)
		);
		expect(php.fileExists(`${docroot}/test.php`)).toBe(true);
		expect(php.readFileAsText(`${docroot}/test.php`)).toBe(content);
	});

	it('should not log error for absolute paths', async () => {
		const content = '<?php echo "Test";';

		await writeFile(php, {
			path: `${docroot}/test.php`,
			data: content,
		});

		expect(loggerErrorSpy).not.toHaveBeenCalled();
		expect(php.fileExists(`${docroot}/test.php`)).toBe(true);
		expect(php.readFileAsText(`${docroot}/test.php`)).toBe(content);
	});

	it('should overwrite existing files', async () => {
		const originalContent = 'Original content';
		const newContent = 'New content';

		// Write initial file
		await writeFile(php, {
			path: `${docroot}/test.txt`,
			data: originalContent,
		});

		// Overwrite with new content
		await writeFile(php, {
			path: `${docroot}/test.txt`,
			data: newContent,
		});

		expect(php.readFileAsText(`${docroot}/test.txt`)).toBe(newContent);
	});
});
