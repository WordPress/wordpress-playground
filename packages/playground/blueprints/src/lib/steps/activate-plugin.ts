import type { UniversalPHP } from '@php-wasm/universal';
import { StepHandler } from '.';

export interface ActivatePluginStep {
	step: 'activatePlugin';
	/* Path to the plugin directory, or the plugin entry file relative to the plugins directory. */
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
$plugin_path = '${pluginPath}';
$plugin_entry_file = $plugin_path;
if (is_dir($plugin_path)) {
	// Find plugin entry file
	$plugin_entry_file = '';
	$files = glob( $plugin_path . '/*.php' );
	if ( $files ) {
		foreach ( $files as $file ) {
			$info = get_plugin_data( $file, false, false );
			if ( ! empty( $info['Name'] ) ) {
				$plugin_entry_file = $file;
				break;
			}
		}
	}
	if (empty($plugin_entry_file)) {
		throw new Exception('Could not find plugin entry file.');
	}
}
activate_plugin($plugin_entry_file);
`,
	});
};
