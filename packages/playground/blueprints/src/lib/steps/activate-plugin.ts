import { phpVar } from '@php-wasm/util';
import { StepHandler } from '.';

/**
 * @inheritDoc activatePlugin
 * @example
 *
 * <code>
 * {
 * 		"step": "activatePlugin",
 * 		"pluginName": "Gutenberg",
 * 		"pluginPath": "/wordpress/wp-content/plugins/gutenberg"
 * }
 * </code>
 */
export interface ActivatePluginStep {
	step: 'activatePlugin';
	/** Path to the plugin directory as absolute path (/wordpress/wp-content/plugins/plugin-name); or the plugin entry file relative to the plugins directory (plugin-name/plugin-name.php). */
	pluginPath: string;
	/** Optional. Plugin name to display in the progress bar. */
	pluginName?: string;
}

/**
 * Activates a WordPress plugin (if it's installed).
 *
 * @param playground The playground client.
 */
export const activatePlugin: StepHandler<ActivatePluginStep> = async (
	playground,
	{ pluginPath, pluginName },
	progress
) => {
	progress?.tracker.setCaption(`Activating ${pluginName || pluginPath}`);

	const docroot = await playground.documentRoot;
	await playground.run({
		code: `<?php
define( 'WP_ADMIN', true );
require_once( ${phpVar(docroot)}. "/wp-load.php" );
require_once( ${phpVar(docroot)}. "/wp-admin/includes/plugin.php" );

// Set current user to admin
set_current_user( get_users(array('role' => 'Administrator') )[0] );

$plugin_path = ${phpVar(pluginPath)};

if (!is_dir($plugin_path)) {
	activate_plugin($plugin_path);
	die();
}

foreach ( ( glob( $plugin_path . '/*.php' ) ?: array() ) as $file ) {
	$info = get_plugin_data( $file, false, false );
	if ( ! empty( $info['Name'] ) ) {
		activate_plugin( $file );
		die();
	}
}

// If we got here, the plugin was not found.
exit(1);
`,
	});
};
