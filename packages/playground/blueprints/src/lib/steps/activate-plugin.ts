import { StepHandler } from '.';

export interface ActivatePluginStep {
	step: 'activatePlugin';
	/* Path to the plugin file relative to the plugins directory. */
	pluginPath: string;
}

/**
 * Activates a WordPress plugin in the Playground.
 *
 * @param playground The playground client.
 * @param plugin The plugin slug.
 */
export const activatePlugin: StepHandler<ActivatePluginStep> = async (
	playground,
	{ pluginPath },
	progress
) => {
	progress?.tracker.setCaption(`Activating ${pluginPath}`);
	const requiredFiles = [
		`${playground.documentRoot}/wp-load.php`,
		`${playground.documentRoot}/wp-admin/includes/plugin.php`,
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
      activate_plugin('${pluginPath}');
      `,
	});
};
