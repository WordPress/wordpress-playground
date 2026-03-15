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

	if (!php.fileExists(wpConfigPath)) {
		return;
	}

	// Ensure required constants are defined.
	const js = phpVars({ wpConfigPath, constants: defaults });
	const result = await php.run({
		code: `${wpConfigTransformer}
		$wp_config_path = ${js.wpConfigPath};
		$transformer    = WP_Config_Transformer::from_file($wp_config_path);
		foreach ( ${js.constants} as $name => $value ) {
			if ( ! $transformer->constant_exists( $name ) ) {
				$transformer->define_constant($name, $value);
			}
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
 * Ensures that the "wp-config.php" file exists for legacy WordPress versions.
 *
 * This uses TypeScript string replacement instead of the PHP-based
 * WP_Config_Transformer. The transformer uses PHP 7.0+ return type
 * declarations and PHP 7.1+ nullable types throughout its class, so
 * running it on PHP 5.6 produces a parse error that crashes the boot.
 *
 * @param php          The PHP instance.
 * @param documentRoot The path to the document root.
 */
export async function ensureLegacyWpConfig(
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

	// Ensure DB_NAME is defined. Use TypeScript string replacement
	// instead of the PHP token transformer.
	let content = new TextDecoder().decode(
		await php.readFileAsBuffer(wpConfigPath)
	);
	if (!wpConfigDefineExists(content, 'DB_NAME')) {
		content = wpConfigInsertConstant(content, 'DB_NAME', 'wordpress');
		await php.writeFile(wpConfigPath, content);
	}
}

/**
 * Defines constants in a WordPress "wp-config.php" file using TypeScript
 * string replacement.
 *
 * Used for legacy WordPress on PHP 5.6 where the PHP-based
 * WP_Config_Transformer cannot run (it requires PHP 7.1+).
 *
 *   1. When a constant is already defined, the definition will be updated.
 *   2. When a constant is not defined, it will be added before the
 *      "stop editing" comment or the require_once wp-settings line.
 *
 * @param php          The PHP instance.
 * @param wpConfigPath The path to the "wp-config.php" file.
 * @param constants    The constants to define.
 */
export async function defineLegacyWpConfigConstants(
	php: UniversalPHP,
	wpConfigPath: string,
	constants: Record<string, unknown>
): Promise<void> {
	let content = new TextDecoder().decode(
		await php.readFileAsBuffer(wpConfigPath)
	);

	for (const [name, value] of Object.entries(constants)) {
		const phpValue =
			typeof value === 'string'
				? `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
				: String(value);

		if (wpConfigDefineExists(content, name)) {
			// Replace the value in the existing define() call.
			// Matches: define( 'CONST_NAME', <any value> )
			const pattern = new RegExp(
				`(define\\s*\\(\\s*'${escapeRegExp(name)}'\\s*,\\s*)` +
					`(?:'[^']*'|"[^"]*"|[^)]+?)` +
					`(\\s*\\))`,
				'g'
			);
			content = content.replace(pattern, `$1${phpValue}$2`);
		} else {
			content = wpConfigInsertConstant(
				content,
				name,
				typeof value === 'string' ? value : String(value)
			);
		}
	}

	await php.writeFile(wpConfigPath, content);
}

/**
 * Checks if a define() call for the given constant name exists in the
 * wp-config.php content string.
 */
function wpConfigDefineExists(content: string, name: string): boolean {
	const pattern = new RegExp(
		`define\\s*\\(\\s*['"]${escapeRegExp(name)}['"]`
	);
	return pattern.test(content);
}

/**
 * Inserts a new define() statement into wp-config.php content, placing
 * it before the "stop editing" comment, the require_once wp-settings
 * line, or at the end of the file.
 */
function wpConfigInsertConstant(
	content: string,
	name: string,
	value: string
): string {
	const phpValue = `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
	const defineStatement = `define( '${name}', ${phpValue} );\n`;

	// Try to insert before "That's all, stop editing!" comment
	const stopEditingIndex = content.indexOf("That's all, stop editing!");
	if (stopEditingIndex !== -1) {
		const lineStart = content.lastIndexOf('\n', stopEditingIndex);
		if (lineStart !== -1) {
			return (
				content.slice(0, lineStart) +
				'\n' +
				defineStatement +
				content.slice(lineStart)
			);
		}
	}

	// Try to insert before require_once ... wp-settings.php
	const settingsRequire = content.indexOf('wp-settings.php');
	if (settingsRequire !== -1) {
		const requireKeyword = content.lastIndexOf('require', settingsRequire);
		if (requireKeyword !== -1) {
			const lineStart = content.lastIndexOf('\n', requireKeyword);
			if (lineStart !== -1) {
				return (
					content.slice(0, lineStart) +
					'\n' +
					defineStatement +
					content.slice(lineStart)
				);
			}
		}
	}

	// Fallback: insert after opening <?php tag
	const phpTagMatch = content.match(/<\?php\s*/);
	if (phpTagMatch) {
		const afterTag = (phpTagMatch.index ?? 0) + phpTagMatch[0].length;
		return (
			content.slice(0, afterTag) +
			'\n' +
			defineStatement +
			content.slice(afterTag)
		);
	}

	// Last resort: prepend
	return '<?php\n' + defineStatement + '?>\n' + content;
}

function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
