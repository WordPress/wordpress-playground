import fs from 'fs-extra';
import path from 'path';

/**
 * Checks if the given path is a WordPress theme directory.
 *
 * @param projectPath The path to the project to check.
 * @returns A boolean value indicating whether the project is a WordPress theme directory.
 */
export function isThemeDirectory(projectPath: string): Boolean {
	const styleCSSExists = fs.existsSync(path.join(projectPath, 'style.css'));
	if (!styleCSSExists) {
		return false;
	}
	const styleCSS = fs.readFileSync(
		path.join(projectPath, 'style.css'),
		'utf-8'
	);
	return styleCSS.includes('Theme Name:');
}
