import { PHP } from '@php-wasm/universal';
import { defineWpConfigConstants, ensureWpConfig } from '../wp-config';
import { RecommendedPHPVersion } from '@wp-playground/common';
// eslint-disable-next-line @nx/enforce-module-boundaries -- ignore test-related interdependencies so we can test.
import { loadNodeRuntime } from '@php-wasm/node';
import { joinPaths } from '@php-wasm/util';

const documentRoot = '/tmp';
const wpConfigPath = joinPaths(documentRoot, 'wp-config.php');
const constsJsonPath = '/internal/shared/consts.json';

function getDefinedConstants(php: PHP): Record<string, unknown> {
	if (!php.fileExists(constsJsonPath)) {
		return {};
	}
	return JSON.parse(php.readFileAsText(constsJsonPath));
}

describe('ensureWpConfig', () => {
	let php: PHP;
	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
	});

	it('should define DB_NAME via defineConstant when wp-config.php does not define it', async () => {
		php.writeFile(wpConfigPath, `<?php`);
		await ensureWpConfig(php, documentRoot);

		// wp-config.php should not be modified.
		expect(php.readFileAsText(wpConfigPath)).toBe(`<?php`);

		// DB_NAME should be defined via the auto-prepend mechanism.
		expect(getDefinedConstants(php)).toHaveProperty('DB_NAME', 'wordpress');

		// DB_NAME should be available at runtime via the auto-prepend script.
		const response = await php.run({
			code: `<?php echo json_encode(['DB_NAME' => DB_NAME]);`,
		});
		expect(response.errors).toHaveLength(0);
		expect(response.json).toEqual({ DB_NAME: 'wordpress' });
	});

	it('should not define DB_NAME when wp-config.php already defines it', async () => {
		php.writeFile(
			wpConfigPath,
			`<?php
			define( 'DB_NAME', 'custom-db' );`
		);
		await ensureWpConfig(php, documentRoot);

		// wp-config.php should not be modified.
		expect(php.readFileAsText(wpConfigPath)).toContain(
			`define( 'DB_NAME', 'custom-db' );`
		);

		// DB_NAME should not be in consts.json.
		expect(getDefinedConstants(php)).not.toHaveProperty('DB_NAME');
	});

	it('should not define DB_NAME when wp-config.php defines it conditionally', async () => {
		php.writeFile(
			wpConfigPath,
			`<?php
			if(!defined('DB_NAME')) {
				define('DB_NAME','defined-conditionally');
			}`
		);
		await ensureWpConfig(php, documentRoot);

		// wp-config.php should not be modified.
		expect(php.readFileAsText(wpConfigPath)).toContain(
			`define('DB_NAME','defined-conditionally');`
		);

		// DB_NAME should not be in consts.json.
		expect(getDefinedConstants(php)).not.toHaveProperty('DB_NAME');
	});

	it('should only define missing constants and preserve pre-existing ones', async () => {
		php.writeFile(
			wpConfigPath,
			`<?php
			define( 'DB_NAME', 'custom-db' );`
		);
		php.defineConstant('WP_HOME', 'http://example.com');
		await ensureWpConfig(php, documentRoot);

		const consts = getDefinedConstants(php);
		expect(consts).not.toHaveProperty('DB_NAME');
		expect(consts).toHaveProperty('WP_HOME', 'http://example.com');
	});
});

/*
 * Tests below execute the rewritten wp-config.php and assert on
 * the JSON output, not just on define() substrings. This proves
 * the file still parses and runs, constants have the expected
 * runtime values, and no warnings or errors were introduced.
 */
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
