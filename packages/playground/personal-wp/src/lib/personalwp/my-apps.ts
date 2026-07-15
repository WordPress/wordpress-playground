import type { PlaygroundClient } from '@wp-playground/remote';
import { encodeStringAsBase64 } from '../base64';

export const MY_APPS_PLUGIN_FILE =
	'/wordpress/wp-content/plugins/my-apps/my-apps.php';

export const MY_APPS_MIGRATION = 'myAppsPluginInstalled';

export const APP_LAUNCHER_BLUEPRINT = {
	$schema: 'https://playground.wordpress.net/blueprint-schema.json',
	meta: {
		title: 'App Launcher',
		description: 'Install more apps with this app launcher',
		author: 'Alex Kirk',
	},
	login: true,
	landingPage: '/my-apps/',
	steps: [
		{
			step: 'installPlugin',
			pluginData: {
				resource: 'git:directory',
				url: 'https://github.com/akirk/my-apps',
				// Personal WP treats my-apps main as a nightly channel.
				ref: 'main',
				refType: 'branch',
			},
			options: {
				targetFolderName: 'my-apps',
			},
		},
	],
};

export const APP_LAUNCHER_BLUEPRINT_URL = blueprintToDataUrl(
	JSON.stringify(APP_LAUNCHER_BLUEPRINT)
);

export function blueprintToDataUrl(blueprint: string): string {
	return `data:application/json;base64,${encodeStringAsBase64(blueprint)}`;
}

export async function hasMyAppsPlugin(
	playground: Pick<PlaygroundClient, 'isFile'>
): Promise<boolean> {
	return await playground.isFile(MY_APPS_PLUGIN_FILE);
}
