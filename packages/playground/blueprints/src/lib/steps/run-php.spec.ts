import { PHP } from '@php-wasm/universal';
import { runPHP } from './run-php';
import { loadNodeRuntime } from '@php-wasm/node';
import { logger } from '@php-wasm/logger';
import { vi } from 'vitest';
import { RecommendedPHPVersion } from '@wp-playground/common';

const phpVersion = RecommendedPHPVersion;
describe('Blueprint step runPHP', () => {
	let php: PHP;
	let loggerErrorSpy: any;

	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(phpVersion));
		loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		loggerErrorSpy.mockRestore();
		php.exit();
	});

	it('should run PHP code', async () => {
		const result = await runPHP(php, { code: '<?php echo "Hello World";' });
		expect(result.text).toBe('Hello World');
	});

	it('should throw on PHP error', async () => {
		await expect(runPHP(php, { code: '<?php $%^;' })).rejects.toThrow();
	});

	it('should log error and normalize relative path with single quotes', async () => {
		const originalCode =
			"<?php require_once 'wordpress/wp-load.php'; echo 'loaded';";

		// Call runPHP with the original code to trigger the path replacement
		// We expect this to fail because wp-load.php doesn't exist, but we want to test the logger
		try {
			await runPHP(php, { code: originalCode });
		} catch {
			// Expected to fail, but logger should have been called
		}

		expect(loggerErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"It looks like you're trying to load WordPress using a relative path"
			)
		);
	});

	it('should log error and normalize relative path with double quotes', async () => {
		const originalCode =
			'<?php require_once "wordpress/wp-load.php"; echo "loaded";';

		// Call runPHP with the original code to trigger the path replacement
		// We expect this to fail because wp-load.php doesn't exist, but we want to test the logger
		try {
			await runPHP(php, { code: originalCode });
		} catch {
			// Expected to fail, but logger should have been called
		}

		expect(loggerErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"It looks like you're trying to load WordPress using a relative path"
			)
		);
	});

	it('should handle both single and double quoted paths in same code', async () => {
		const originalCode =
			'<?php echo "wordpress/wp-load.php"; echo \'wordpress/wp-load.php\';';

		// Call runPHP with the original code to trigger the path replacement
		const result = await runPHP(php, { code: originalCode });

		expect(loggerErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"It looks like you're trying to load WordPress using a relative path"
			)
		);
		// Verify the paths were replaced
		expect(result.text).toContain('/wordpress/wp-load.php');
	});

	it('should not log error for absolute paths', async () => {
		const codeWithAbsolutePath =
			"<?php echo '/wordpress/wp-load.php is absolute';";

		const result = await runPHP(php, { code: codeWithAbsolutePath });

		expect(loggerErrorSpy).not.toHaveBeenCalled();
		expect(result.text).toContain('/wordpress/wp-load.php');
	});

	it('should not trigger on unrelated wordpress strings', async () => {
		const codeWithUnrelatedWordpress =
			'<?php echo "This is about wordpress/wp-load.php but not a require";';

		const result = await runPHP(php, { code: codeWithUnrelatedWordpress });

		expect(loggerErrorSpy).not.toHaveBeenCalled();
		expect(result.text).toContain('wordpress/wp-load.php');
	});

	it('should replace relative paths in code', async () => {
		const codeWithRelativePath =
			'<?php echo "wordpress/wp-load.php"; echo \'wordpress/wp-load.php\';';

		const result = await runPHP(php, { code: codeWithRelativePath });

		// Verify the paths were replaced in the output
		expect(result.text).toContain('/wordpress/wp-load.php');
		expect(loggerErrorSpy).toHaveBeenCalled();
	});
});
