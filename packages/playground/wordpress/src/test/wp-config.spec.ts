import { PHP } from '@php-wasm/universal';
import { defineWpConfigConstants, ensureWpConfig } from '../wp-config';
import { RecommendedPHPVersion } from '@wp-playground/common';
// eslint-disable-next-line @nx/enforce-module-boundaries -- ignore test-related interdependencies so we can test.
import { loadNodeRuntime } from '@php-wasm/node';
import { joinPaths } from '@php-wasm/util';

const documentRoot = '/tmp';
const wpConfigPath = joinPaths(documentRoot, 'wp-config.php');

/*
 * Tests below execute the rewritten wp-config.php and assert on
 * the JSON output, not just on define() substrings. This proves
 * the file still parses and runs, constants have the expected
 * runtime values, and no warnings or errors were introduced.
 */
describe('ensureWpConfig', () => {
	let php: PHP;
	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
	});

	it('should define required constants when they are missing', async () => {
		php.writeFile(
			wpConfigPath,
			`<?php
			echo json_encode([
				'DB_NAME' => DB_NAME,
			]);`
		);
		await ensureWpConfig(php, documentRoot);

		const rewritten = php.readFileAsText(wpConfigPath);
		expect(rewritten).toContain(`define( 'DB_NAME', 'wordpress' );`);

		const response = await php.run({ code: rewritten });
		expect(response.json).toEqual({
			DB_NAME: 'wordpress',
		});
	});

	it('should only define missing constants', async () => {
		php.writeFile(
			wpConfigPath,
			`<?php
			define( 'DB_USER', 'unchanged' );
			define( 'AUTH_KEY', 'unchanged' );
			define( 'WP_DEBUG', true );
			echo json_encode([
				'DB_NAME' => DB_NAME,
				'DB_USER' => DB_USER,
				'AUTH_KEY' => AUTH_KEY,
				'WP_DEBUG' => WP_DEBUG,
			]);`
		);
		await ensureWpConfig(php, documentRoot);

		const rewritten = php.readFileAsText(wpConfigPath);
		expect(rewritten).toContain(`define( 'DB_NAME', 'wordpress' );`);
		expect(rewritten).toContain(`define( 'DB_USER', 'unchanged' );`);
		expect(rewritten).not.toContain(
			`define( 'DB_USER', 'username_here' );`
		);
		expect(rewritten).toContain(`define( 'AUTH_KEY', 'unchanged' );`);
		expect(rewritten).not.toContain(
			`define( 'AUTH_KEY', 'put your unique phrase here' );`
		);
		expect(rewritten).toContain(`define( 'WP_DEBUG', true );`);
		expect(rewritten).not.toContain(`define( 'WP_DEBUG', false );`);

		const response = await php.run({ code: rewritten });
		expect(response.json).toEqual({
			DB_NAME: 'wordpress',
			DB_USER: 'unchanged',
			AUTH_KEY: 'unchanged',
			WP_DEBUG: true,
		});
	});

	it('should not define required constants when they are already defined conditionally', async () => {
		php.writeFile(
			wpConfigPath,
			`<?php
			if(!defined('DB_NAME')) {
				define('DB_NAME','defined-conditionally');
			}
			echo json_encode([
				'DB_NAME' => DB_NAME,
			]);`
		);
		await ensureWpConfig(php, documentRoot);

		const rewritten = php.readFileAsText(wpConfigPath);
		expect(rewritten).not.toContain(`define( 'DB_NAME', 'wordpress' );`);

		const response = await php.run({ code: rewritten });
		expect(response.json).toEqual({
			DB_NAME: 'defined-conditionally',
		});
	});
});

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

	it('should define new constants', async () => {
		php.writeFile(
			wpConfigPath,
			`<?php
			echo json_encode([
				"SITE_URL" => SITE_URL,
			]);`
		);
		await defineWpConfigConstants(php, wpConfigPath, {
			SITE_URL: 'http://test.url',
		});

		const rewritten = php.readFileAsText(wpConfigPath);
		expect(rewritten).toContain(`define( 'SITE_URL', 'http://test.url' );`);

		const response = await php.run({ code: rewritten });
		expect(response.errors).toHaveLength(0);
		expect(response.json).toEqual({
			SITE_URL: 'http://test.url',
		});
	});

	it('should update an existing constant', async () => {
		php.writeFile(
			wpConfigPath,
			`<?php
			define('SITE_URL','http://initial.value');
			echo json_encode([
				"SITE_URL" => SITE_URL,
			]);`
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
			]);`
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

	it('should handle a complex scenario', async () => {
		php.writeFile(
			wpConfigPath,
			`<?php
define('WP_DEBUG', true);

// The third define() argument is also supported:
@define('SAVEQUERIES', false, true);

// Expression
define(true ? 'WP_DEBUG_LOG' : 'WP_DEBUG_LOG', 123);

// Guarded expression
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
			SAVEQUERIES: true,
			NEW_CONSTANT: 'new constant',
		};
		await defineWpConfigConstants(php, wpConfigPath, constants);

		const rewritten = php.readFileAsText(wpConfigPath);
		const response = await php.run({ code: rewritten });
		expect(response.errors).toHaveLength(0);
		expect(response.json).toEqual({
			WP_DEBUG: false,
			SAVEQUERIES: true,
			WP_DEBUG_LOG: 123,
			NEW_CONSTANT: 'new constant',
		});
	});
});
