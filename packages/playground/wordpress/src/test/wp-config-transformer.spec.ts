import fs from 'node:fs';
import path from 'node:path';
import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
// eslint-disable-next-line @nx/enforce-module-boundaries -- ignore test-related interdependencies so we can test.
import { loadNodeRuntime } from '@php-wasm/node';
import { phpVars } from '@php-wasm/util';

import wpConfigTransformer from '../wp-config-transformer.php?raw';

// load wp-config-sample.php
const wpConfigSample = fs.readFileSync(
	path.join(import.meta.dirname, 'wp-config-sample.php'),
	'utf8'
);

const codeSample = `
/*
 * BEGIN: Added by WordPress Playground.
 *
 * This code was injected by WordPress Playground.
 */
if ( ! defined( 'DB_NAME' ) ) {
	define( 'DB_NAME', 'wordpress' );
}
if ( ! defined( 'DB_USER' ) ) {
	define( 'DB_USER', 'wordpress' );
}
/* END: Added by WordPress Playground. */
`;

describe('wp-config-transformer.php', () => {
	let php: PHP;

	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
	});

	it('should detect whether a constant is defined', async () => {
		const js = phpVars({ wpConfig: wpConfigSample });
		const phpCode = `${wpConfigTransformer}
		$transformer = new WP_Config_Transformer(${js.wpConfig});
		echo json_encode([
			'DB_NAME' => $transformer->constant_exists( 'DB_NAME' ),
			'DB_USER' => $transformer->constant_exists( 'DB_USER' ),
			'DB_PASSWORD' => $transformer->constant_exists( 'DB_PASSWORD' ),
			'DB_HOST' => $transformer->constant_exists( 'DB_HOST' ),
			'DB_CHARSET' => $transformer->constant_exists( 'DB_CHARSET' ),
			'DB_COLLATE' => $transformer->constant_exists( 'DB_COLLATE' ),
			'WP_DEBUG' => $transformer->constant_exists( 'WP_DEBUG' ),
			'AUTH_KEY' => $transformer->constant_exists( 'AUTH_KEY' ),
			'SECURE_AUTH_KEY' => $transformer->constant_exists( 'SECURE_AUTH_KEY' ),
			'LOGGED_IN_KEY' => $transformer->constant_exists( 'LOGGED_IN_KEY' ),
			'NONCE_KEY' => $transformer->constant_exists( 'NONCE_KEY' ),
			'AUTH_SALT' => $transformer->constant_exists( 'AUTH_SALT' ),
			'SECURE_AUTH_SALT' => $transformer->constant_exists( 'SECURE_AUTH_SALT' ),
			'LOGGED_IN_SALT' => $transformer->constant_exists( 'LOGGED_IN_SALT' ),
			'NONCE_SALT' => $transformer->constant_exists( 'NONCE_SALT' ),
			'ABSPATH' => $transformer->constant_exists( 'ABSPATH' ),
			'WP_MEMORY_LIMIT' => $transformer->constant_exists( 'WP_MEMORY_LIMIT' ),
			'NEW_CONSTANT_1' => $transformer->constant_exists( 'NEW_CONSTANT_1' ),
			'NEW_CONSTANT_2' => $transformer->constant_exists( 'NEW_CONSTANT_2' ),
		]);
		`;
		const response = await php.run({ code: phpCode });
		expect(response.errors).toEqual('');
		expect(response.json).toEqual({
			DB_NAME: true,
			DB_USER: true,
			DB_PASSWORD: true,
			DB_HOST: true,
			DB_CHARSET: true,
			DB_COLLATE: true,
			WP_DEBUG: true,
			AUTH_KEY: true,
			SECURE_AUTH_KEY: true,
			LOGGED_IN_KEY: true,
			NONCE_KEY: true,
			AUTH_SALT: true,
			SECURE_AUTH_SALT: true,
			LOGGED_IN_SALT: true,
			NONCE_SALT: true,
			ABSPATH: true,
			WP_MEMORY_LIMIT: false,
			NEW_CONSTANT_1: false,
			NEW_CONSTANT_2: false,
		});
	});

	it('should detect whether a new constant is defined', async () => {
		const js = phpVars({ wpConfig: wpConfigSample });
		const phpCode = `${wpConfigTransformer}
		$transformer = new WP_Config_Transformer(${js.wpConfig});
		$transformer->define_constant( 'NEW_CONSTANT_1', 'new-constant-1' );
		$transformer->define_constant( 'NEW_CONSTANT_2', 'new-constant-2' );
		echo json_encode([
			'DB_NAME' => $transformer->constant_exists( 'DB_NAME' ),
			'NEW_CONSTANT_1' => $transformer->constant_exists( 'NEW_CONSTANT_1' ),
			'NEW_CONSTANT_2' => $transformer->constant_exists( 'NEW_CONSTANT_2' ),
			'NEW_CONSTANT_3' => $transformer->constant_exists( 'NEW_CONSTANT_3' ),
		]);
		`;
		const response = await php.run({ code: phpCode });
		expect(response.errors).toEqual('');
		expect(response.json).toEqual({
			DB_NAME: true,
			NEW_CONSTANT_1: true,
			NEW_CONSTANT_2: true,
			NEW_CONSTANT_3: false,
		});
	});

	it('should not modify the wp-config.php file when no changes are made', async () => {
		const js = phpVars({ wpConfig: wpConfigSample });
		const phpCode = `${wpConfigTransformer}

		$transformer = new WP_Config_Transformer(${js.wpConfig});
		echo $transformer->to_string();
		`;

		const response = await php.run({ code: phpCode });
		expect(response.errors).toEqual('');
		expect(response.text).toEqual(wpConfigSample);
	});

	it('should update an existing constant', async () => {
		const wpConfig = `<?php
define( 'WP_DEBUG', false );
`;

		const js = phpVars({ wpConfig });
		const phpCode = `${wpConfigTransformer}

		$transformer = new WP_Config_Transformer(${js.wpConfig});
		$transformer->define_constant( 'WP_DEBUG', true );
		echo $transformer->to_string();
		`;

		const response = await php.run({ code: phpCode });
		expect(response.errors).toEqual('');
		expect(response.text).toEqual(`<?php
define( 'WP_DEBUG', true );
`);
	});

	it('should preserve the third argument in existing define() call', async () => {
		const wpConfig = `<?php
define( 'WP_DEBUG', false, true );
`;

		const js = phpVars({ wpConfig });
		const phpCode = `${wpConfigTransformer}

		$transformer = new WP_Config_Transformer(${js.wpConfig});
		$transformer->define_constant( 'WP_DEBUG', true );
		echo $transformer->to_string();
		`;

		const response = await php.run({ code: phpCode });
		expect(response.errors).toEqual('');
		expect(response.text).toEqual(`<?php
define( 'WP_DEBUG', true, true );
`);
	});

	it('should update all occurrences of an existing constant when there are duplicates', async () => {
		const wpConfig = `<?php
if ( 'production' === $env ) {
	define( 'WP_DEBUG', false );
} else {
	define( 'WP_DEBUG', true );
}
`;

		const js = phpVars({ wpConfig });
		const phpCode = `${wpConfigTransformer}

		$transformer = new WP_Config_Transformer(${js.wpConfig});
		$transformer->define_constant( 'WP_DEBUG', true );
		echo $transformer->to_string();
		`;

		const response = await php.run({ code: phpCode });
		expect(response.errors).toEqual('');
		expect(response.text).toEqual(`<?php
if ( 'production' === $env ) {
	define( 'WP_DEBUG', true );
} else {
	define( 'WP_DEBUG', true );
}
`);
	});

	it('should update all occurrences when old and new values have different token counts', async () => {
		const wpConfig = `<?php
if ( 'production' === $env ) {
	define( 'SITE_URL', 'http://production.example.com' );
} else {
	define( 'SITE_URL', 'http://dev.example.com' );
}
`;

		const js = phpVars({ wpConfig });
		const phpCode = `${wpConfigTransformer}

		$transformer = new WP_Config_Transformer(${js.wpConfig});
		$transformer->define_constant( 'SITE_URL', NULL );
		echo $transformer->to_string();
		`;

		const response = await php.run({ code: phpCode });
		expect(response.errors).toEqual('');
		expect(response.text).toEqual(`<?php
if ( 'production' === $env ) {
	define( 'SITE_URL', NULL );
} else {
	define( 'SITE_URL', NULL );
}
`);
	});

	it('should define a new constant above the "That\'s all, stop editing!" comment', async () => {
		const wpConfig = `<?php
define( 'WP_DEBUG', false );

/* Add any custom values between this line and the "stop editing" line. */
/* That's all, stop editing! Happy publishing. */
`;

		const js = phpVars({ wpConfig });
		const phpCode = `${wpConfigTransformer}

		$transformer = new WP_Config_Transformer(${js.wpConfig});
		$transformer->define_constant( 'NEW_CONSTANT', true );
		echo $transformer->to_string();
		`;

		const response = await php.run({ code: phpCode });
		expect(response.errors).toEqual('');
		expect(response.text).toEqual(`<?php
define( 'WP_DEBUG', false );

/* Add any custom values between this line and the "stop editing" line. */
define( 'NEW_CONSTANT', true );
/* That's all, stop editing! Happy publishing. */
`);
	});

	it('should define a new constant above the "Absolute path to the WordPress directory." comment as a fallback', async () => {
		const wpConfig = `<?php
define( 'WP_DEBUG', false );

/** Absolute path to the WordPress directory. */
`;

		const js = phpVars({ wpConfig });
		const phpCode = `${wpConfigTransformer}

		$transformer = new WP_Config_Transformer(${js.wpConfig});
		$transformer->define_constant( 'NEW_CONSTANT', true );
		echo $transformer->to_string();
		`;

		const response = await php.run({ code: phpCode });
		expect(response.errors).toEqual('');
		expect(response.text).toEqual(`<?php
define( 'WP_DEBUG', false );

define( 'NEW_CONSTANT', true );
/** Absolute path to the WordPress directory. */
`);
	});

	it('should define a new constant above the require statement for "wp-settings.php" as a fallback', async () => {
		const wpConfig = `<?php
define( 'WP_DEBUG', false );

require_once ABSPATH . 'wp-settings.php';
`;

		const js = phpVars({ wpConfig });
		const phpCode = `${wpConfigTransformer}

		$transformer = new WP_Config_Transformer(${js.wpConfig});
		$transformer->define_constant( 'NEW_CONSTANT', true );
		echo $transformer->to_string();
		`;

		const response = await php.run({ code: phpCode });
		expect(response.errors).toEqual('');
		expect(response.text).toEqual(`<?php
define( 'WP_DEBUG', false );

define( 'NEW_CONSTANT', true );
require_once ABSPATH . 'wp-settings.php';
`);
	});

	it('should define a new constant at the beginning of the file as a fallback', async () => {
		const wpConfig = `<?php\n`;

		const js = phpVars({ wpConfig });
		const phpCode = `${wpConfigTransformer}

		$transformer = new WP_Config_Transformer(${js.wpConfig});
		$transformer->define_constant( 'NEW_CONSTANT', true );
		echo $transformer->to_string();
		`;

		const response = await php.run({ code: phpCode });
		expect(response.errors).toEqual('');
		expect(response.text).toEqual(`<?php
define( 'NEW_CONSTANT', true );
`);
	});

	it('should inject code before the "Sets up WordPress vars and included files." comment', async () => {
		const wpConfig = `<?php
define( 'WP_DEBUG', false );

/* Add any custom values between this line and the "stop editing" line. */
/* That's all, stop editing! Happy publishing. */

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';
`;

		const js = phpVars({ wpConfig });
		const phpCode = `${wpConfigTransformer}

		$transformer = new WP_Config_Transformer(${js.wpConfig});
		$transformer->inject_code_block( '/* INJECTED CODE */' );
		echo $transformer->to_string();
		`;

		const response = await php.run({ code: phpCode });
		expect(response.errors).toEqual('');
		expect(response.text).toEqual(`<?php
define( 'WP_DEBUG', false );

/* Add any custom values between this line and the "stop editing" line. */
/* That's all, stop editing! Happy publishing. */

/* INJECTED CODE */

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';
`);
	});

	it('should inject code before the require statement for "wp-settings.php" as a fallback', async () => {
		const wpConfig = `<?php
define( 'WP_DEBUG', false );

/* Add any custom values between this line and the "stop editing" line. */
/* That's all, stop editing! Happy publishing. */

require_once ABSPATH . 'wp-settings.php';
`;

		const js = phpVars({ wpConfig });
		const phpCode = `${wpConfigTransformer}

		$transformer = new WP_Config_Transformer(${js.wpConfig});
		$transformer->inject_code_block( '/* INJECTED CODE */' );
		echo $transformer->to_string();
		`;

		const response = await php.run({ code: phpCode });
		expect(response.errors).toEqual('');
		expect(response.text).toEqual(`<?php
define( 'WP_DEBUG', false );

/* Add any custom values between this line and the "stop editing" line. */
/* That's all, stop editing! Happy publishing. */

/* INJECTED CODE */

require_once ABSPATH . 'wp-settings.php';
`);
	});

	it('should inject code at the beginning of the file as a fallback', async () => {
		const wpConfig = `<?php

define( 'WP_DEBUG', false );
`;

		const js = phpVars({ wpConfig });
		const phpCode = `${wpConfigTransformer}

		$transformer = new WP_Config_Transformer(${js.wpConfig});
		$transformer->inject_code_block( '/* INJECTED CODE */' );
		echo $transformer->to_string();
		`;

		const response = await php.run({ code: phpCode });
		expect(response.errors).toEqual('');
		expect(response.text).toEqual(`<?php

/* INJECTED CODE */

define( 'WP_DEBUG', false );
`);
	});

	it('should remove code between two comment fragments', async () => {
		const wpConfig = `<?php
define( 'WP_DEBUG', false );

/* This is a START comment */
define( 'INJECTED_CODE', true );
/* This is an END comment */
`;

		const js = phpVars({ wpConfig });
		const phpCode = `${wpConfigTransformer}

		$transformer = new WP_Config_Transformer(${js.wpConfig});
		$transformer->remove_code_block( 'START', 'END' );
		echo $transformer->to_string();
		`;

		const response = await php.run({ code: phpCode });
		expect(response.errors).toEqual('');
		expect(response.text).toEqual(`<?php
define( 'WP_DEBUG', false );

`);
	});

	it('should handle a real-world scenario', async () => {
		const js = phpVars({ wpConfig: wpConfigSample });
		const phpCode = `${wpConfigTransformer}

		$transformer = new WP_Config_Transformer(${js.wpConfig});
		$transformer->inject_code_block( "${codeSample}" );
		$transformer->define_constant( 'WP_DEBUG', true );
		$transformer->define_constant( 'DB_NAME', 'wordpress-database' );
		$transformer->define_constant( 'DB_COLLATE', 'utf8mb4_0900_ai_ci' );
		$transformer->define_constant( 'WP_MEMORY_LIMIT', '256M' );
		$transformer->define_constant( 'AUTOMATIC_UPDATER_DISABLED', false );
		$transformer->define_constant( 'AUTOMATIC_UPDATER_DISABLED', true ); // override previously set value
		if ( ! $transformer->constant_exists( 'WP_DEBUG' ) ) {
			throw new Exception( 'WP_DEBUG is not defined' );
		}
		if ( ! $transformer->constant_exists( 'WP_MEMORY_LIMIT' ) ) {
			throw new Exception( 'WP_MEMORY_LIMIT is not defined' );
		}
		if ( ! $transformer->constant_exists( 'AUTOMATIC_UPDATER_DISABLED' ) ) {
			throw new Exception( 'AUTOMATIC_UPDATER_DISABLED is not defined' );
		}
		if ( $transformer->constant_exists( 'UNKNOWN_CONSTANT' ) ) {
			throw new Exception( 'UNKNOWN_CONSTANT is defined' );
		}
		echo $transformer->to_string();
		`;

		const response = await php.run({ code: phpCode });
		expect(response.errors).toEqual('');

		expect(response.text).toContain(`
// ** Database settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'wordpress-database' );

/** Database username */
define( 'DB_USER', 'username_here' );
`);

		expect(response.text).toContain(`
/** The database collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', 'utf8mb4_0900_ai_ci' );

/**#@+
 * Authentication unique keys and salts.
`);

		expect(response.text).toContain(`
/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the documentation.
 *
 * @link https://developer.wordpress.org/advanced-administration/debug/debug-wordpress/
 */
define( 'WP_DEBUG', true );

/* Add any custom values between this line and the "stop editing" line. */
`);

		expect(response.text).toContain(`
/* Add any custom values between this line and the "stop editing" line. */



define( 'WP_MEMORY_LIMIT', '256M' );
define( 'AUTOMATIC_UPDATER_DISABLED', true );
/* That's all, stop editing! Happy publishing. */
`);

		expect(response.text).toContain(`
/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/*
 * BEGIN: Added by WordPress Playground.
 *
 * This code was injected by WordPress Playground.
 */
if ( ! defined( 'DB_NAME' ) ) {
	define( 'DB_NAME', 'wordpress-database' );
}
if ( ! defined( 'DB_USER' ) ) {
	define( 'DB_USER', 'wordpress' );
}
/* END: Added by WordPress Playground. */

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';
`);
	});
});
