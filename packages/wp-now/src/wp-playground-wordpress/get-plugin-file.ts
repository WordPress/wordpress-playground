import fs from 'fs-extra';
import path from 'path';

/**
 *
 * @param projectPath The path to the plugin.
 * @returns Path to the plugin file relative to the plugins directory.
 */
export function getPluginFile(projectPath: string) {
	const files = fs.readdirSync(projectPath);
	for (const file of files) {
		if (file.endsWith('.php')) {
			const fileContent = fs.readFileSync(
				path.join(projectPath, file),
				'utf8'
			);
			if (fileContent.includes('Plugin Name:')) {
				return path.join(path.basename(projectPath), file);
			}
		}
	}
	return null;
}
