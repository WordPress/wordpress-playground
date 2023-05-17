import fs from 'fs-extra';
import path from 'path';

/**
 * Checks if the given path is a WordPress wp-content directory.
 *
 * @param projectPath The path to the project to check.
 * @returns A boolean value indicating whether the project is a WordPress wp-content directory.
 */
export function isWpContentDirectory(projectPath: string): Boolean {
	const muPluginsExists = fs.existsSync(path.join(projectPath, 'mu-plugins'));
	const pluginsExists = fs.existsSync(path.join(projectPath, 'plugins'));
	const themesExists = fs.existsSync(path.join(projectPath, 'themes'));
	if (muPluginsExists || pluginsExists || themesExists) {
		return true;
	}
	return false;
}
