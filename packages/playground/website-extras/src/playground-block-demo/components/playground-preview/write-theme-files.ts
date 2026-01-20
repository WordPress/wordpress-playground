/**
 * Utility for writing theme files to WordPress Playground.
 *
 * Creates a demo-theme directory in wp-content/themes and writes
 * the provided files there, then activates the theme.
 */

import type { PlaygroundClient } from '@wp-playground/client';
// @ts-ignore - activateTheme may not be typed
import { activateTheme } from '@wp-playground/client';
import type { EditorFile } from '../../base64';

export async function writeThemeFiles(
	client: PlaygroundClient,
	files: EditorFile[]
) {
	const docroot = await client.documentRoot;
	const themeFolderName = 'demo-theme';
	const themePath = docroot + '/wp-content/themes/' + themeFolderName;

	// Remove existing theme directory if it exists
	const pathExists = await client.fileExists(themePath);
	if (pathExists) {
		await client.rmdir(themePath, { recursive: true });
	}

	// Create the theme directory
	await client.mkdir(themePath);

	// Write each file
	for (const file of files) {
		const filePath = `${themePath}/${file.name}`;
		const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));

		// Ensure parent directory exists
		if (dirPath !== themePath) {
			await client.mkdir(dirPath);
		}

		await client.writeFile(filePath, file.contents);
	}

	// Activate the theme
	try {
		await activateTheme(client, {
			themeFolderName,
		});
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error('Failed to activate theme:', error);
	}
}
