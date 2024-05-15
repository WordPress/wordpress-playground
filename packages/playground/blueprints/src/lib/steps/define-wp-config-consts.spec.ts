import { NodePHP } from '@php-wasm/node';
import { rewriteDefineCalls, defineBeforeRun } from './define-wp-config-consts';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	enablePlatformMuPlugins,
	preloadRequiredMuPlugin,
} from '@wp-playground/wordpress';

describe('rewriteDefineCalls', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(RecommendedPHPVersion, {
			requestHandler: {
				documentRoot: '/wordpress',
			},
		});
	});

	it('should print warnings when a constant name conflicts, just to make sure other tests would fail', async () => {
		const phpCode = `<?php
		define('SITE_URL','http://initial.value');
		define('SITE_URL','http://initial.value');
		`;
		const response = await php.run({ code: phpCode });
		expect(response.errors).toContain('Constant SITE_URL already defined');
		expect(response.text).toContain('Constant SITE_URL already defined');
	});

	it('should prepend constants not already present in the PHP code', async () => {
		const phpCode = `<?php
		echo json_encode([
			"SITE_URL" => SITE_URL,
		]);
		`;
		const rewritten = await rewriteDefineCalls(php, phpCode, {
			SITE_URL: 'http://test.url',
		});
		expect(rewritten).toContain(`define('SITE_URL','http://test.url');`);

		const response = await php.run({ code: rewritten });
		expect(response.errors).toHaveLength(0);
		expect(response.json).toEqual({
			SITE_URL: 'http://test.url',
		});
	});

	it('should rewrite the define() calls for the constants that are already defined in the PHP code', async () => {
		const phpCode = `<?php
		define('SITE_URL','http://initial.value');
		echo json_encode([
			"SITE_URL" => SITE_URL,
		]);
		`;
		const rewritten = await rewriteDefineCalls(php, phpCode, {
			SITE_URL: 'http://new.url',
		});
		expect(rewritten).not.toContain(
			`define('SITE_URL','http://initial.value');`
		);
		expect(rewritten).toContain(`define('SITE_URL','http://new.url');`);

		const response = await php.run({ code: rewritten });
		expect(response.errors).toHaveLength(0);
		expect(response.json).toEqual({
			SITE_URL: 'http://new.url',
		});
	});

	it('should preserve the third argument in existing define() calls', async () => {
		const phpCode = `<?php
		define('SITE_URL','http://initial.value',true);
		echo json_encode([
			"SITE_URL" => SITE_URL,
		]);
		`;
		const rewritten = await rewriteDefineCalls(php, phpCode, {
			SITE_URL: 'http://new.url',
		});
		expect(rewritten).not.toContain(
			`define('SITE_URL','http://initial.value',true);`
		);
		expect(rewritten).toContain(
			`define('SITE_URL','http://new.url',true);`
		);

		const response = await php.run({ code: rewritten });

		expect(response.errors).toContain(
			'case-insensitive constants is no longer supported'
		);
		expect(response.text).toContain(`{"SITE_URL":"http:\\/\\/new.url"}`);
	});

	it('should take define() calls where the constant name cannot be statically inferred and wrap them in if(!defined()) checks', async () => {
		const phpCode = `<?php
		define('SITE'.'_URL','http://initial.value');
		echo json_encode([
			"SITE_URL" => SITE_URL,
		]);
		`;
		const rewritten = await rewriteDefineCalls(php, phpCode, {});
		expect(rewritten).toContain(`if(!defined('SITE'.'_URL'))`);
		expect(rewritten).toContain(
			`define('SITE'.'_URL','http://initial.value');`
		);

		const response = await php.run({ code: rewritten });
		expect(response.errors).toHaveLength(0);
		expect(response.json).toEqual({
			SITE_URL: 'http://initial.value',
		});
	});

	it('should not wrap the existing define() calls in if(!defined()) guards twice', async () => {
		const phpCode = `<?php
		if(!defined('SITE'.'_URL')) {
			define('SITE'.'_URL','http://initial.value');
		}
		echo json_encode([
			"SITE_URL" => SITE_URL,
		]);
		`;
		const rewritten = await rewriteDefineCalls(php, phpCode, {});
		expect(rewritten).toEqual(phpCode);
	});

	it('should not wrap the existing define() calls in if(!defined()) guards twice, even if the existing guard is formatted differently than the define() call', async () => {
		const phpCode = `<?php
		if ( ! defined(
			'SITE' .
			'_URL'
		) ) {
			define('SITE'.'_URL','http://initial.value');
		}
		echo json_encode([
			"SITE_URL" => SITE_URL,
		]);
		`;
		const rewritten = await rewriteDefineCalls(php, phpCode, {});
		expect(rewritten).toEqual(phpCode);
	});

	it('should not create conflicts between pre-existing "dynamically" named constants and the newly defined ones', async () => {
		const phpCode = `<?php
		define('SITE'.'_URL','http://initial.value');
		echo json_encode([
			"SITE_URL" => SITE_URL,
		]);
		`;
		const rewritten = await rewriteDefineCalls(php, phpCode, {
			SITE_URL: 'http://new.url',
		});
		expect(rewritten).toContain(`if(!defined('SITE'.'_URL'))`);
		expect(rewritten).toContain(
			`define('SITE'.'_URL','http://initial.value');`
		);
		expect(rewritten).toContain(`define('SITE_URL','http://new.url');`);

		const response = await php.run({ code: rewritten });
		expect(response.errors).toHaveLength(0);
		expect(response.json).toEqual({
			SITE_URL: 'http://new.url',
		});
	});

	it('should handle a complex scenario', async () => {
		const phpCode = `<?php
define('WP_DEBUG', true);

// The third define() argument is also supported:
@define('SAVEQUERIES', false, true);

// Expression
define(true ? 'WP_DEBUG_LOG' : 'WP_DEBUG_LOG', 123);

// Guarded expressions shouldn't be wrapped twice
if(!defined(1 ? 'A' : 'B')) {
    define(1 ? 'A' : 'B', 0);
}

// More advanced expression
$x = 'abc';
define((function() use($x) {
    return $x;
})(), 123);
echo json_encode([
	"WP_DEBUG" => WP_DEBUG,
	"SAVEQUERIES" => SAVEQUERIES,
	"WP_DEBUG_LOG" => WP_DEBUG_LOG,
	"NEW_CONSTANT" => NEW_CONSTANT,
]);
		`;
		const constants = {
			WP_DEBUG: false,
			WP_DEBUG_LOG: true,
			SAVEQUERIES: true,
			NEW_CONSTANT: 'new constant',
		};
		const rewritten = await rewriteDefineCalls(php, phpCode, constants);
		const response = await php.run({ code: rewritten });
		expect(response.errors).toHaveLength(0);
		expect(response.json).toEqual(constants);
	});
});

describe('defineBeforeRun', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(RecommendedPHPVersion, {
			requestHandler: {
				documentRoot: '/wordpress',
			},
		});
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

	it('should not work when PHP code is run via the php.run({ code: `` }) call instead of the scriptPath mode (KNOWN LIMITATION)', async () => {
		const constants = {
			SITE_URL: 'http://test.url',
		};
		await defineBeforeRun(php, constants);
		await expect(
			php.run({
				code: `<?php echo json_encode(['SITE_URL' => SITE_URL]);`,
			})
		).rejects.toThrow('PHP.run() failed with exit code');
	});

	it('should not raise a warning when conflicting with a user-defined constant', async () => {
		// Preload the warning-silencing error handler
		await enablePlatformMuPlugins(php);
		await preloadRequiredMuPlugin(php);

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
