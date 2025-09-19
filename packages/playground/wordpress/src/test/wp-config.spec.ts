import fs from 'node:fs';
import path from 'node:path';
import { PHP } from '@php-wasm/universal';
import { defineWpConfigConstants, ensureWpConfig } from '../wp-config';
import { RecommendedPHPVersion } from '@wp-playground/common';
// eslint-disable-next-line @nx/enforce-module-boundaries -- ignore test-related interdependencies so we can test.
import { loadNodeRuntime } from '@php-wasm/node';
import { joinPaths } from '@php-wasm/util';

const documentRoot = '/tmp';
const wpConfigPath = joinPaths(documentRoot, 'wp-config.php');

// load wp-config-sample.php
const wpConfigSample = fs.readFileSync(
	path.join(import.meta.dirname, 'wp-config-sample.php'),
	'utf8'
);

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
				'DB_USER' => DB_USER,
				'DB_PASSWORD' => DB_PASSWORD,
				'DB_HOST' => DB_HOST,
				'DB_CHARSET' => DB_CHARSET,
				'DB_COLLATE' => DB_COLLATE,
				'AUTH_KEY' => AUTH_KEY,
				'SECURE_AUTH_KEY' => SECURE_AUTH_KEY,
				'LOGGED_IN_KEY' => LOGGED_IN_KEY,
				'NONCE_KEY' => NONCE_KEY,
				'AUTH_SALT' => AUTH_SALT,
				'SECURE_AUTH_SALT' => SECURE_AUTH_SALT,
				'LOGGED_IN_SALT' => LOGGED_IN_SALT,
				'NONCE_SALT' => NONCE_SALT,
				'WP_DEBUG' => WP_DEBUG,
			]);`
		);
		await ensureWpConfig(php, documentRoot);

		const rewritten = php.readFileAsText(wpConfigPath);
		expect(rewritten).toContain(
			`define( 'DB_NAME', 'database_name_here' );`
		);
		expect(rewritten).toContain(`define( 'DB_USER', 'username_here' );`);
		expect(rewritten).toContain(
			`define( 'DB_PASSWORD', 'password_here' );`
		);
		expect(rewritten).toContain(`define( 'DB_HOST', 'localhost' );`);
		expect(rewritten).toContain(`define( 'DB_CHARSET', 'utf8' );`);
		expect(rewritten).toContain(`define( 'DB_COLLATE', '' );`);
		expect(rewritten).toContain(
			`define( 'AUTH_KEY', 'put your unique phrase here' );`
		);
		expect(rewritten).toContain(
			`define( 'SECURE_AUTH_KEY', 'put your unique phrase here' );`
		);
		expect(rewritten).toContain(
			`define( 'LOGGED_IN_KEY', 'put your unique phrase here' );`
		);
		expect(rewritten).toContain(
			`define( 'NONCE_KEY', 'put your unique phrase here' );`
		);
		expect(rewritten).toContain(
			`define( 'AUTH_SALT', 'put your unique phrase here' );`
		);
		expect(rewritten).toContain(
			`define( 'SECURE_AUTH_SALT', 'put your unique phrase here' );`
		);
		expect(rewritten).toContain(
			`define( 'LOGGED_IN_SALT', 'put your unique phrase here' );`
		);
		expect(rewritten).toContain(
			`define( 'NONCE_SALT', 'put your unique phrase here' );`
		);
		expect(rewritten).toContain(`define( 'WP_DEBUG', false );`);

		const response = await php.run({ code: rewritten });
		expect(response.json).toEqual({
			DB_NAME: 'database_name_here',
			DB_USER: 'username_here',
			DB_PASSWORD: 'password_here',
			DB_HOST: 'localhost',
			DB_CHARSET: 'utf8',
			DB_COLLATE: '',
			AUTH_KEY: 'put your unique phrase here',
			SECURE_AUTH_KEY: 'put your unique phrase here',
			LOGGED_IN_KEY: 'put your unique phrase here',
			NONCE_KEY: 'put your unique phrase here',
			AUTH_SALT: 'put your unique phrase here',
			SECURE_AUTH_SALT: 'put your unique phrase here',
			LOGGED_IN_SALT: 'put your unique phrase here',
			NONCE_SALT: 'put your unique phrase here',
			WP_DEBUG: false,
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
				'DB_PASSWORD' => DB_PASSWORD,
				'DB_COLLATE' => DB_COLLATE,
				'AUTH_KEY' => AUTH_KEY,
				'AUTH_SALT' => AUTH_SALT,
				'NONCE_SALT' => NONCE_SALT,
				'WP_DEBUG' => WP_DEBUG,
			]);`
		);
		await ensureWpConfig(php, documentRoot);

		const rewritten = php.readFileAsText(wpConfigPath);
		expect(rewritten).toContain(
			`define( 'DB_NAME', 'database_name_here' );`
		);
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
			DB_NAME: 'database_name_here',
			DB_USER: 'unchanged',
			DB_PASSWORD: 'password_here',
			DB_COLLATE: '',
			AUTH_KEY: 'unchanged',
			AUTH_SALT: 'put your unique phrase here',
			NONCE_SALT: 'put your unique phrase here',
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
		expect(rewritten).not.toContain(
			`define( 'DB_NAME', 'database_name_here' );`
		);

		const response = await php.run({ code: rewritten });
		expect(response.json).toEqual({
			DB_NAME: 'defined-conditionally',
		});
	});

	it('should define missing constants well-formatted', async () => {
		php.writeFile(
			wpConfigPath,
			wpConfigSample
				.replace("'DB_NAME'", "'UNKNOWN_CONSTANT'")
				.replace("'DB_USER'", "'UNKNOWN_CONSTANT'")
		);

		await ensureWpConfig(php, documentRoot);

		const rewritten = php.readFileAsText(wpConfigPath);
		expect(rewritten).toContain(`
/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/*
 * BEGIN: Added by WordPress Playground.
 *
 * WordPress Playground detected that some required WordPress configuration was
 * missing in this file. Since the auto-configure mode was enabled, the missing
 * configuration was automatically added with sensible default values below.
 *
 * It's safe to remove this block and define the missing configuration manually,
 * or you can keep it, as it won't interfere with any existing configuration.
 */
if ( ! defined( 'DB_NAME' ) ) {
	define( 'DB_NAME', 'database_name_here' );
}
if ( ! defined( 'DB_USER' ) ) {
	define( 'DB_USER', 'username_here' );
}
/* END: Added by WordPress Playground. */

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';
`);
	});

	it("should remove the injected configuration when it's no longer needed", async () => {
		php.writeFile(
			wpConfigPath,
			wpConfigSample.replace("'DB_NAME'", "'UNKNOWN_CONSTANT'")
		);
		await ensureWpConfig(php, documentRoot);

		// Inject configuration with the "DB_NAME" default value.
		const rewritten1 = php.readFileAsText(wpConfigPath);
		expect(rewritten1).toContain(`BEGIN: Added by WordPress Playground.`);
		expect(rewritten1).toContain(`END: Added by WordPress Playground.`);
		expect(rewritten1).toContain(
			`define( 'DB_NAME', 'database_name_here' );`
		);

		php.writeFile(
			wpConfigPath,
			php
				.readFileAsText(wpConfigPath)
				.replace("'UNKNOWN_CONSTANT'", "'DB_NAME'")
				.replace("'database_name_here'", "'my_database_name'")
		);
		await ensureWpConfig(php, documentRoot);

		// Remove the injected configuration.
		const rewritten2 = php.readFileAsText(wpConfigPath);
		expect(rewritten2).not.toContain(
			`START: Added by WordPress Playground.`
		);
		expect(rewritten2).not.toContain(`END: Added by WordPress Playground.`);
		expect(rewritten2).not.toContain(
			`define( 'DB_NAME', 'database_name_here' );`
		);
		expect(rewritten2).toContain(
			`define( 'DB_NAME', 'my_database_name' );`
		);
		expect(rewritten2).toContain(`
/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';
`);
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

	it('should define a new constants', async () => {
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
