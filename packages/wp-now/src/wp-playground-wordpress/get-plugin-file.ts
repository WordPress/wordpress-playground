import fs from 'fs-extra';
import path, { basename } from 'path';

/**
 *
 * @param filePath The path to the file to read.
 * @param length The number of bytes to read from the file. By default 8KB.
 * @returns The first `length` bytes of the file as string.
 * @see https://developer.wordpress.org/reference/functions/get_file_data/
 */
function readFileHead(filePath: string, length = 8192) {
	const buffer = Buffer.alloc(length);
	const fd = fs.openSync(filePath, 'r');
	fs.readSync(fd, buffer, 0, buffer.length, 0);
	const fileContentBuffer = buffer.toString('utf8');
	fs.closeSync(fd);
	return fileContentBuffer.toString();
}

/**
 * Sorts the files in the given array using a heuristic.
 * The plugin file usually has the same name as the project folder.
 * @param files The files to sort.
 * @returns The sorted files.
 */
function heuristicSort(files: string[], projectPath: string) {
	const heuristicsBestGuess = `${basename(projectPath)}.php`;
	const heuristicsBestGuessIndex = files.indexOf(heuristicsBestGuess);
	if (heuristicsBestGuessIndex !== -1) {
		files.splice(heuristicsBestGuessIndex, 1);
		files.unshift(heuristicsBestGuess);
	}
	return files;
}

/**
 *
 * @param projectPath The path to the plugin.
 * @returns Path to the plugin file relative to the plugins directory.
 */
export function getPluginFile(projectPath: string) {
	const files = heuristicSort(fs.readdirSync(projectPath), projectPath);
	for (const file of files) {
		if (file.endsWith('.php')) {
			const fileContent = readFileHead(path.join(projectPath, file));
			const pluginNameRegex = /\/\*[\s\S]*?Plugin Name:[\s\S]*?\*\//i;
			if (pluginNameRegex.test(fileContent)) {
				return path.join(path.basename(projectPath), file);
			}
		}
	}
	return null;
}
