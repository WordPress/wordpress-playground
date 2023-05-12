import fs from 'fs-extra';
import path from 'path';

/**
 * Checks if the given path is a WordPress plugin.
 *
 * @param projectPath The path to the project to check.
 * @returns A boolean value indicating whether the project is a WordPress plugin.
 */
export function isPluginDirectory(projectPath: string): Boolean {
	const files = fs.readdirSync(projectPath);
	for (const file of files) {
		if (file.endsWith('.php')) {
			const fileContent = fs.readFileSync(
				path.join(projectPath, file),
				'utf8'
			);
			if (fileContent.includes('Plugin Name:')) {
				return true;
			}
		}
	}
	return false;
}
