import fs from 'fs-extra';
import path from 'path';

/**
 * Checks if the given path is a WordPress-develop directory.
 *
 * @param projectPath The path to the project to check.
 * @returns Is it a WordPress-develop directory?
 */
export function isWordPressDevelopDirectory(projectPath: string): boolean {
	const requiredFiles = [
		'src',
		'src/wp-content',
		'src/wp-includes',
		'src/wp-load.php',
		'build',
		'build/wp-content',
		'build/wp-includes',
		'build/wp-load.php',
	];

	return requiredFiles.every((file) =>
		fs.existsSync(path.join(projectPath, file))
	);
}
