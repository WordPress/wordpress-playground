import { joinPaths, phpVars } from '@php-wasm/util';
import type { UniversalPHP } from '@php-wasm/universal';

/* @ts-ignore */
import wpConfigTransformer from './wp-config-transformer.php?raw';

/**
 * Ensures that "wp-config.php" exists and required constants are defined.
 *
 *   - Copies "wp-config-sample.php" to "wp-config.php" if it doesn't exist.
 *   - Defines fallback values for missing constants without modifying "wp-config.php".
 *
 * @param php          The PHP instance.
 * @param documentRoot The path to the document root.
 */
export async function ensureWpConfig(
	php: UniversalPHP,
	documentRoot: string
): Promise<void> {
	const wpConfigPath = joinPaths(documentRoot, 'wp-config.php');

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

	if (!php.fileExists(wpConfigPath)) {
		return;
	}

	// Ensure missing constants are defined without modifying "wp-config.php".
	await defineWpConfigConstantFallbacks(php, wpConfigPath, {
		DB_NAME: 'wordpress',
	});
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
		$transformer = WP_Config_Transformer::from_file($wp_config_path);
		$transformer->define_constants(${js.constants});
		$transformer->to_file($wp_config_path);
		`,
	});
	if (result.errors.length > 0) {
		throw new Error('Failed to rewrite constants in wp-config.php.');
	}
}

/**
 * Defines fallback values for constants missing from "wp-config.php".
 *
 * This function does NOT modify "wp-config.php":
 *
 *    1. It checks "wp-config.php" to determine which constants are missing.
 *    2. It defines the missing constants via the PHP auto-prepend script.
 *
 * @param php          The PHP instance.
 * @param wpConfigPath The path to the "wp-config.php" file.
 * @param fallbacks    The constants to define if missing.
 */
async function defineWpConfigConstantFallbacks(
	php: UniversalPHP,
	wpConfigPath: string,
	fallbacks: Record<string, string | boolean | number | null>
): Promise<void> {
	const constantNames = Object.keys(fallbacks);
	const js = phpVars({ wpConfigPath, constantNames });
	const result = await php.run({
		code: `${wpConfigTransformer}
		$transformer = WP_Config_Transformer::from_file(${js.wpConfigPath});
		$missing = [];
		foreach (${js.constantNames} as $name) {
			if (!$transformer->constant_exists($name)) {
				$missing[] = $name;
			}
		}
		echo json_encode($missing);
		`,
	});
	if (result.errors.length > 0) {
		throw new Error('Failed to check wp-config.php for constants.');
	}

	// Define the missing constants via the PHP auto-prepend script.
	let missing: string[];
	try {
		missing = JSON.parse(result.text);
	} catch {
		throw new Error(
			`Failed to parse wp-config.php constant check output: ${result.text}`
		);
	}
	for (const name of missing) {
		await php.defineConstant(name, fallbacks[name]);
	}
}
