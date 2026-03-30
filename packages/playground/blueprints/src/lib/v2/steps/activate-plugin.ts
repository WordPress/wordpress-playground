import type { V2StepHandler } from '../types';
import { phpVar } from '@php-wasm/util';
import { registerV2StepHandler } from './index';

interface ActivatePluginArgs {
	pluginPath: string;
}

/**
 * Activates an already-installed WordPress plugin.
 *
 * The pluginPath should be either an absolute path to the
 * plugin directory or the plugin entry file relative to the
 * plugins directory (e.g. "plugin-name/plugin-name.php").
 */
const handler: V2StepHandler<ActivatePluginArgs> = async (args, context) => {
	const { php } = context;
	const docroot = await php.documentRoot;

	await php.run({
		code: `<?php
define('WP_ADMIN', true);
require_once(${phpVar(docroot)} . '/wp-load.php');
require_once(${phpVar(docroot)} . '/wp-admin/includes/plugin.php');

wp_set_current_user(
	get_users(array('role' => 'Administrator'))[0]->ID
);

$plugin_path = ${phpVar(args.pluginPath)};
$response = activate_plugin($plugin_path);

if (is_wp_error($response)) {
	throw new Exception(
		'Failed to activate plugin: ' .
		$response->get_error_message()
	);
}
`,
	});
};

registerV2StepHandler('activatePlugin', handler);
