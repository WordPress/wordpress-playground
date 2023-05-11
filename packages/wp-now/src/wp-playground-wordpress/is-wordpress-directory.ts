import fs from 'fs-extra';
import path from 'path';

/**
 * Checks if the given path is a WordPress directory.
 *
 * @param projectPath The path to the project to check.
 * @returns Is it a WordPress directory?
 */
export function isWordPressDirectory(projectPath: string): Boolean {
	return (
		fs.existsSync(path.join(projectPath, 'wp-content')) &&
		fs.existsSync(path.join(projectPath, 'wp-includes')) &&
		fs.existsSync(path.join(projectPath, 'wp-load.php'))
	);
}
