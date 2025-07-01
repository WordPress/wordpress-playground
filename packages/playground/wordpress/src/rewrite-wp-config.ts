import { joinPaths, phpVars } from '@php-wasm/util';
import type { UniversalPHP } from '@php-wasm/universal';

/* @ts-ignore */
import rewriteWpConfigToDefineConstants from './rewrite-wp-config-to-define-constants.php?raw';

/**
 * Defines constants in a WordPress "wp-config.php" file.
 *
 * @param php                The PHP instance.
 * @param wpConfigPath       The path to the "wp-config.php" file.
 * @param constants          The constants to define.
 * @param whenAlreadyDefined What to do if the constant is already defined.
 *                           Possible values are:
 *                             'rewrite' - Rewrite the constant, using the new value.
 *                             'skip'    - Skip the definition, keeping the existing value.
 */
export async function defineWpConfigConstants(
	php: UniversalPHP,
	wpConfigPath: string,
	constants: Record<string, unknown>,
	whenAlreadyDefined: 'rewrite' | 'skip' = 'rewrite'
): Promise<void> {
	const js = phpVars({ wpConfigPath, constants, whenAlreadyDefined });
	const result = await php.run({
		code: `<?php ob_start(); ?>
			${rewriteWpConfigToDefineConstants}
			$wp_config_path = ${js.wpConfigPath};
			$wp_config = file_get_contents($wp_config_path);
			$new_wp_config = rewrite_wp_config_to_define_constants($wp_config, ${js.constants}, ${js.whenAlreadyDefined});
			$return_value = file_put_contents($wp_config_path, $new_wp_config);
			ob_clean();
			echo false === $return_value ? '0' : '1';
			ob_end_flush();
		`,
	});
	if (result.text !== '1') {
		throw new Error('Failed to rewrite constants in wp-config.php.');
	}
}

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
	documentRoot: string
): Promise<void> {
	const wpConfigPath = joinPaths(documentRoot, 'wp-config.php');
	const defaults = {
		DB_NAME: 'wordpress',
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

	await defineWpConfigConstants(php, wpConfigPath, defaults, 'skip');
}
