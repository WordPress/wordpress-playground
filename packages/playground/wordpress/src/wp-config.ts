import { joinPaths, phpVars } from '@php-wasm/util';
import type { UniversalPHP } from '@php-wasm/universal';

/* @ts-ignore */
import wpConfigTransformer from './wp-config-transformer.php?raw';

/**
 * Ensures that the "wp-config.php" file exists and required constants are defined.
 *
 * When a required constant is missing, it will be defined with a default value.
 *
 * @param php          The PHP instance.
 * @param documentRoot The path to the document root.
 */
export async function ensureWpConfig(
	php: UniversalPHP,
	documentRoot: string,
	defaultConstants: Record<string, string | number | boolean | null> = {}
): Promise<void> {
	const wpConfigPath = joinPaths(documentRoot, 'wp-config.php');

	// The default values for constants listed in "wp-config-sample.php".
	const defaults = {
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
		...defaultConstants,
	};

	/**
	 * WordPress requires a wp-config.php file to be present during
	 * the site installation.
	 *
	 * If the mounted site doesn't have a wp-config.php file,
	 * we copy the wp-config-sample.php file to it if it exists.
	 *
	 * This enables Playground to mount a WordPress project
	 * that hasn't already been installed or configured.
	 *
	 * For example, a user can download a WordPress zip file
	 * from wordpress.org, extract it and mount the folder
	 * into Playground.
	 */
	if (
		!php.fileExists(wpConfigPath) &&
		php.fileExists(joinPaths(documentRoot, 'wp-config-sample.php'))
	) {
		await php.writeFile(
			wpConfigPath,
			await php.readFileAsBuffer(
				joinPaths(documentRoot, 'wp-config-sample.php')
			)
		);
	}

	// When we still don't have a wp-config.php file, there's nothing to be done.
	if (!php.fileExists(wpConfigPath)) {
		return;
	}

	// Ensure required constants are defined.
	const js = phpVars({ wpConfigPath, constants: defaults });
	const result = await php.run({
		code: `${wpConfigTransformer}
$wp_config_path = ${js.wpConfigPath};
$transformer    = Wp_Config_Transformer::from_file($wp_config_path);

$prefix = <<<EOF
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
EOF;

$suffix = "/* END: Added by WordPress Playground. */";

$transformer->remove_code_block(
	'BEGIN: Added by WordPress Playground.',
	'END: Added by WordPress Playground.'
);

// Then, inject what's missing.
$code = '';
foreach ( ${js.constants} as $name => $value ) {
	if ( ! $transformer->constant_exists( $name ) ) {
		$code .= sprintf(
			"if ( ! defined( %s ) ) {\n\tdefine( %s, %s );\n}\n",
			var_export( $name, true ),
			var_export( $name, true ),
			var_export( $value, true )
		);
	}
}

// If some constants are missing, add the prefix and suffix and inject them.
if ( '' !== $code ) {
	$code = $prefix . "\n" . $code . $suffix;
	$transformer->inject_code_block($code);
}
$transformer->to_file($wp_config_path);
`,
	});
	if (result.errors.length > 0) {
		throw new Error('Failed to auto-configure wp-config.php.');
	}
}

/**
 * Defines constants in a WordPress "wp-config.php" file.
 *
 * This function modifies the "wp-config.php" file to define the given constants.
 *
 *   1. When a constant is already defined, the definition will be updated.
 * 	 2. When a constant is not defined, it will be added in an appropriate
 *      location within the file (typically before the "stop editing" line).
 *
 * @param php          The PHP instance.
 * @param wpConfigPath The path to the "wp-config.php" file.
 * @param constants    The constants to define.
 */
export async function defineWpConfigConstants(
	php: UniversalPHP,
	wpConfigPath: string,
	constants: Record<string, unknown>
): Promise<void> {
	const js = phpVars({ wpConfigPath, constants });
	const result = await php.run({
		code: `${wpConfigTransformer}
		$wp_config_path = ${js.wpConfigPath};
		$transformer = Wp_Config_Transformer::from_file($wp_config_path);
		$transformer->define_constants(${js.constants});
		$transformer->to_file($wp_config_path);
		`,
	});
	if (result.errors.length > 0) {
		throw new Error('Failed to rewrite constants in wp-config.php.');
	}
}
