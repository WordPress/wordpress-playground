/**
 * Utility for writing plugin files to WordPress Playground.
 *
 * Creates a demo-plugin directory in wp-content/plugins and writes
 * the provided files there, then activates the plugin.
 */

import type { PlaygroundClient } from '@wp-playground/client';
// @ts-ignore - activatePlugin may not be typed
import { activatePlugin } from '@wp-playground/client';
import type { EditorFile } from '../../base64';

export async function writePluginFiles(
	client: PlaygroundClient,
	files: EditorFile[]
) {
	const docroot = await client.documentRoot;
	const pluginPath = `${docroot}/wp-content/plugins/demo-plugin`;

	// Remove existing plugin directory if it exists
	const pathExists = await client.fileExists(pluginPath);
	if (pathExists) {
		await client.rmdir(pluginPath, { recursive: true });
	}

	// Create the plugin directory
	await client.mkdir(pluginPath);

	// Write each file
	for (const file of files) {
		const filePath = `${pluginPath}/${file.name}`;
		const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));

		// Ensure parent directory exists
		if (dirPath !== pluginPath) {
			await client.mkdir(dirPath);
		}

		await client.writeFile(filePath, file.contents);
	}

	// Activate the plugin
	try {
		await activatePlugin(client as any, {
			pluginPath,
		});
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error('Failed to activate plugin:', error);
	}
}
