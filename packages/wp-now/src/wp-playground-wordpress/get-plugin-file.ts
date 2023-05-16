import fs from 'fs-extra';
import path from 'path';

export function getPluginFile(projectPath: string) {
	const files = fs.readdirSync(projectPath);
	for (const file of files) {
		if (file.endsWith('.php')) {
			const fileContent = fs.readFileSync(
				path.join(projectPath, file),
				'utf8'
			);
			if (fileContent.includes('Plugin Name:')) {
				return file;
			}
		}
	}
	return null;
}
