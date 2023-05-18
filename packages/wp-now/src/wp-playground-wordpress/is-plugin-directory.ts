import { getPluginFile } from './get-plugin-file';

/**
 * Checks if the given path is a WordPress plugin.
 *
 * @param projectPath The path to the project to check.
 * @returns A boolean value indicating whether the project is a WordPress plugin.
 */
export function isPluginDirectory(projectPath: string): Boolean {
	const pluginFile = getPluginFile(projectPath);
	return pluginFile !== null;
}
