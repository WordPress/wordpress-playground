import fs from 'fs-extra';
import path, { basename } from 'path';
import { readFileHead } from './read-file-head';

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
			const pluginNameRegex =
				/^(?:[ \t]*<\?php)?[ \t/*#@]*Plugin Name:(.*)$/im;
			if (pluginNameRegex.test(fileContent)) {
				return path.join(path.basename(projectPath), file);
			}
		}
	}
	return null;
}
