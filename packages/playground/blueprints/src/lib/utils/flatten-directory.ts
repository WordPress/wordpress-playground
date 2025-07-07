import type { UniversalPHP } from '@php-wasm/universal';
import { dirname, joinPaths } from '@php-wasm/util';

/**
 * Flattens a directory.
 * If the directory contains only one file, it will be moved to the parent
 * directory. Otherwise, the directory will be renamed to the default name.
 *
 * @param php Playground client.
 * @param directoryPath The directory to flatten.
 * @param defaultName The name to use if the directory contains only one file.
 * @returns The final path of the directory.
 */
export async function flattenDirectory(
	php: UniversalPHP,
	directoryPath: string,
	defaultName: string
) {
	if (!(await php.fileExists(directoryPath))) {
		throw new Error(
			`Cannot flatten a directory that does not exist: ${directoryPath}`
		);
	}
	const parentPath = dirname(directoryPath);

	const filesInside = await php.listFiles(directoryPath);
	if (filesInside.length === 1) {
		const onlyFilePath = joinPaths(directoryPath, filesInside[0]);
		const isDir = await php.isDir(onlyFilePath);
		if (isDir) {
			const finalPath = joinPaths(parentPath, filesInside[0]);
			await php.mv(onlyFilePath, finalPath);
			await php.rmdir(directoryPath, { recursive: true });
			return finalPath;
		}
	}

	const finalPath = joinPaths(parentPath, defaultName);
	await php.mv(directoryPath, finalPath);
	return finalPath;
}
