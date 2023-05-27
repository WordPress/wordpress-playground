import type { UniversalPHP } from '@php-wasm/universal';
import { StepHandler } from '.';

export interface ActivatePluginStep {
	step: 'activatePlugin';
	/* Path to the plugin file relative to the plugins directory. */
	pluginPath: string;
	/* Optional plugin name */
	pluginName?: string;
}

/**
 * Activates a WordPress plugin in the Playground.
 *
 * @param playground The playground client.
 * @param plugin The plugin slug.
 */
export const activatePlugin: StepHandler<ActivatePluginStep> = async (
	playground,
	{ pluginPath, pluginName },
	progress
) => {
	// Path to plugin entry file relative to plugins directory
	const pluginRelativePath = pluginPath.split('/').slice().join('/');

	progress?.tracker.setCaption(`Activating ${pluginName || pluginPath}`);
	const requiredFiles = [
		`${await playground.documentRoot}/wp-load.php`,
		`${await playground.documentRoot}/wp-admin/includes/plugin.php`,
	];
	const requiredFilesExist = requiredFiles.every((file) =>
		playground.fileExists(file)
	);
	if (!requiredFilesExist) {
		throw new Error(
			`Required WordPress files do not exist: ${requiredFiles.join(', ')}`
		);
	}
	await playground.run({
		code: `<?php
      ${requiredFiles.map((file) => `require_once( '${file}' );`).join('\n')}
      activate_plugin('${pluginRelativePath}');
      `,
	});
};

/**
 * Find plugin entry file from its folder path.
 *
 * Based on logic in WordPress class Plugin_Upgrader and function get_file_data.
 *
 * @param playground The playground client.
 * @param pluginFolderPath The plugin folder path.
 */
export const findPluginEntryFile = async (
	playground: UniversalPHP,
	pluginFolderPath: string
): Promise<string | undefined> => {
	const result = await playground.run({
		code: `<?php
$files = glob( "${pluginFolderPath}/" . '*.php' );
if ( $files ) {
	foreach ( $files as $file ) {

		// Pull only the first 8 KB of the file in.
		$file_data = file_get_contents( $file, false, null, 0, 8192 );
		if ( false === $file_data ) continue;

		if ( preg_match( '/^(?:[ \\t]*<\\?php)?[ \\t\\/*#@]*' . preg_quote( 'Plugin Name', '/' ) . ':(.*)$/mi', $file_data, $match ) && $match[1] ) {
			echo $file;
			return;
		}
	}
}
`,
	});
	return result.text;
};
