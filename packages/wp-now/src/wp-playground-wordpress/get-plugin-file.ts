import fs from 'fs-extra';
import path from 'path';

/**
 *
 * @param filePath The path to the file to read.
 * @param length The number of bytes to read from the file. By default 4KB.
 * @returns The first `length` bytes of the file as string.
 */
function readFileHead(filePath: string, length = 4096) {
	const buffer = Buffer.alloc(length);
	const fd = fs.openSync(filePath, 'r');
	fs.readSync(fd, buffer, 0, buffer.length, 0);
	const fileContentBuffer = buffer.toString('utf8');
	fs.closeSync(fd);
	return fileContentBuffer.toString();
}

/**
 *
 * @param projectPath The path to the plugin.
 * @returns Path to the plugin file relative to the plugins directory.
 */
export function getPluginFile(projectPath: string) {
	const files = fs.readdirSync(projectPath);
	for (const file of files) {
		if (file.endsWith('.php')) {
			const fileContent = readFileHead(path.join(projectPath, file));
			const pluginNameRegex = /\*[\s]*Plugin name:\s*/i;
			if (pluginNameRegex.test(fileContent)) {
				return path.join(path.basename(projectPath), file);
			}
		}
	}
	return null;
}
