import fs from 'fs-extra';
import path from 'path';

/**
 * Checks if the given path has an index.php file
 *
 * @param projectPath The path to the project to check.
 * @returns A boolean value indicating whether the project has an index.php file.
 */
export function hasIndexFile(projectPath: string): Boolean {
	return fs.existsSync(path.join(projectPath, 'index.php'));
}
