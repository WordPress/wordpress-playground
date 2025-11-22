import { PHP } from '@php-wasm/universal';
import { defineBeforeRun } from './define-wp-config-consts';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { loadNodeRuntime } from '@php-wasm/node';
import { setupPlatformLevelMuPlugins } from '@wp-playground/wordpress';

describe('defineBeforeRun', () => {
	let php: PHP;
	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
	});

	afterEach(() => {
		php.exit();
	});

	it('should define the constants before running the requested script', async () => {
		const constants = {
			SITE_URL: 'http://test.url',
		};
		await defineBeforeRun(php, constants);
		php.writeFile(
			'/index.php',
			`<?php echo json_encode(['SITE_URL' => SITE_URL]);`
		);
		const response = await php.run({
			scriptPath: '/index.php',
		});
		expect(response.errors).toHaveLength(0);
		expect(response.json).toEqual(constants);
	});

	it('should work when the first PHP code run is trigerred via the php.run({ code: `` }) call instead of the scriptPath mode', async () => {
		const constants = {
			SITE_URL: 'http://test.url',
		};
		await defineBeforeRun(php, constants);
		const response = await php.run({
			code: `<?php echo json_encode("abc");`,
		});
		expect(response.text).toBe('"abc"');
	});

	it('should not raise a warning when conflicting with a user-defined constant', async () => {
		// Preload the warning-silencing error handler
		await setupPlatformLevelMuPlugins(php);

		const constants = {
			SITE_URL: 'http://test.url',
		};
		await defineBeforeRun(php, constants);
		php.writeFile(
			'/index.php',
			`<?php
			// This should be warning-free:
			define('SITE_URL', 'another value');

			// This should trigger a warning:
			define('ANOTHER_CONSTANT', 'first');
			define('ANOTHER_CONSTANT', 'second');
			`
		);
		const response = await php.run({
			scriptPath: '/index.php',
		});
		expect(response.errors).toEqual(
			'PHP Warning:  Constant ANOTHER_CONSTANT already defined in /index.php on line 7\n'
		);
	});
});
