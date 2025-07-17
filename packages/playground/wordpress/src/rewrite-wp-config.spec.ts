import { PHP } from '@php-wasm/universal';
import { defineWpConfigConstants, ensureWpConfig } from './rewrite-wp-config';
import { RecommendedPHPVersion } from '@wp-playground/common';
// eslint-disable-next-line @nx/enforce-module-boundaries -- ignore test-related interdependencies so we can test.
import { loadNodeRuntime } from '@php-wasm/node';
import { joinPaths } from '@php-wasm/util';

const documentRoot = '/tmp';
const wpConfigPath = joinPaths(documentRoot, 'wp-config.php');

describe('defineWpConfigConstants', () => {
	let php: PHP;
	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
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
		php.writeFile(
			wpConfigPath,
			`<?php
		echo json_encode([
			"SITE_URL" => SITE_URL,
		]);
		`
		);
		await defineWpConfigConstants(php, wpConfigPath, {
			SITE_URL: 'http://test.url',
		});

		const rewritten = php.readFileAsText(wpConfigPath);
		expect(rewritten).toContain(`define('SITE_URL','http://test.url');`);

		const response = await php.run({ code: rewritten });
		expect(response.errors).toHaveLength(0);
		expect(response.json).toEqual({
			SITE_URL: 'http://test.url',
		});
	});

	it('should rewrite the define() calls for the constants that are already defined in the PHP code', async () => {
		php.writeFile(
			wpConfigPath,
			`<?php
		define('SITE_URL','http://initial.value');
		echo json_encode([
			"SITE_URL" => SITE_URL,
		]);
		`
		);
		await defineWpConfigConstants(php, wpConfigPath, {
			SITE_URL: 'http://new.url',
		});

		const rewritten = php.readFileAsText(wpConfigPath);
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
		php.writeFile(
			wpConfigPath,
			`<?php
		define('SITE_URL','http://initial.value',true);
		echo json_encode([
			"SITE_URL" => SITE_URL,
		]);
		`
		);
		await defineWpConfigConstants(php, wpConfigPath, {
			SITE_URL: 'http://new.url',
		});

		const rewritten = php.readFileAsText(wpConfigPath);
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
		php.writeFile(
			wpConfigPath,
			`<?php
		define('SITE'.'_URL','http://initial.value');
		echo json_encode([
			"SITE_URL" => SITE_URL,
		]);
		`
		);
		await defineWpConfigConstants(php, wpConfigPath, {});

		const rewritten = php.readFileAsText(wpConfigPath);
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
		php.writeFile(wpConfigPath, phpCode);
		await defineWpConfigConstants(php, wpConfigPath, {});

		const rewritten = php.readFileAsText(wpConfigPath);
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
		php.writeFile(wpConfigPath, phpCode);
		await defineWpConfigConstants(php, wpConfigPath, {});

		const rewritten = php.readFileAsText(wpConfigPath);
		expect(rewritten).toEqual(phpCode);
	});

	it('should not create conflicts between pre-existing "dynamically" named constants and the newly defined ones', async () => {
		php.writeFile(
			wpConfigPath,
			`<?php
		define('SITE'.'_URL','http://initial.value');
		echo json_encode([
			"SITE_URL" => SITE_URL,
		]);
		`
		);
		await defineWpConfigConstants(php, wpConfigPath, {
			SITE_URL: 'http://new.url',
		});

		const rewritten = php.readFileAsText(wpConfigPath);
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
		php.writeFile(
			wpConfigPath,
			`<?php
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
		`
		);
		const constants = {
			WP_DEBUG: false,
			WP_DEBUG_LOG: true,
			SAVEQUERIES: true,
			NEW_CONSTANT: 'new constant',
		};
		await defineWpConfigConstants(php, wpConfigPath, constants);

		const rewritten = php.readFileAsText(wpConfigPath);
		const response = await php.run({ code: rewritten });
		expect(response.errors).toHaveLength(0);
		expect(response.json).toEqual(constants);
	});
});

describe('ensureWpConfig', () => {
	let php: PHP;
	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
	});

	it('should define required constants if they are not defined', async () => {
		php.writeFile(wpConfigPath, '<?php');
		await ensureWpConfig(php, documentRoot);

		const rewritten = php.readFileAsText(wpConfigPath);
		expect(rewritten).toContain(`define('DB_NAME','wordpress');`);
	});

	it('should define required constants when only other constants are defined', async () => {
		php.writeFile(
			wpConfigPath,
			`<?php
		define('DB_USER','user');
		`
		);
		await ensureWpConfig(php, documentRoot);

		const rewritten = php.readFileAsText(wpConfigPath);
		expect(rewritten).toContain(`define('DB_NAME','wordpress');`);
	});

	it('should not define required constants, when they are already defined', async () => {
		php.writeFile(
			wpConfigPath,
			`<?php
		define('DB_NAME','already-defined');
		`
		);
		await ensureWpConfig(php, documentRoot);

		const rewritten = php.readFileAsText(wpConfigPath);
		expect(rewritten).not.toContain(`define('DB_NAME','wordpress');`);
	});

	it('should not define required constants, when they are already defined conditionally', async () => {
		php.writeFile(
			wpConfigPath,
			`<?php
		if(!defined('DB_NAME')) {
			define('DB_NAME','defined-conditionally');
		}
		`
		);

		const rewritten = php.readFileAsText(wpConfigPath);
		expect(rewritten).not.toContain(`define('DB_NAME','wordpress');`);
	});
});
