import { StepHandler } from '.';

export interface ActivatePluginStep {
	step: 'activatePlugin';
	/* Path to the plugin directory as absolute path (/wordpress/wp-content/plugins/plugin-name); or the plugin entry file relative to the plugins directory (plugin-name/plugin-name.php). */
	pluginPath: string;
	/* Optional plugin name */
	pluginName?: string;
}

/**
 * Activates a WordPress plugin in the Playground.
 *
 * @param playground The playground client.
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

	const result = await playground.run({
		code: `<?php
define( 'WP_ADMIN', true );
${requiredFiles.map((file) => `require_once( '${file}' );`).join('\n')}
$plugin_path = '${pluginPath}';
if (!is_dir($plugin_path)) {
	activate_plugin($plugin_path);
	return;
}
// Find plugin entry file
foreach ( ( glob( $plugin_path . '/*.php' ) ?: array() ) as $file ) {
	$info = get_plugin_data( $file, false, false );
	if ( ! empty( $info['Name'] ) ) {
		activate_plugin( $file );
		return;
	}
}
echo 'NO_ENTRY_FILE';
`,
	});
	if (result.text.endsWith('NO_ENTRY_FILE')) {
		throw new Error('Could not find plugin entry file.');
	}
};
