import { joinPaths, normalizePath } from '@php-wasm/util';
import { StreamedFile } from '@php-wasm/stream-compression';
import { UniversalPHP } from './universal-php';
import { streamReadFileFromPHP } from './stream-read-file-from-php';

export type IteratePhpFilesOptions = {
	/**
	 * Should yield paths relative to the root directory?
	 * If false, all paths will be absolute.
	 */
	relativePaths?: boolean;

	/**
	 * A prefix to add to all paths.
	 * Only used if `relativePaths` is true.
	 */
	pathPrefix?: string;

	/**
	 * A list of paths to exclude from the results.
	 */
	exceptPaths?: string[];
};

/**
 * Iterates over all files in a php directory and its subdirectories.
 *
 * @param php - The PHP instance.
 * @param root - The root directory to start iterating from.
 * @param options - Optional configuration.
 * @returns All files found in the tree.
 */
export async function* iteratePhpFiles(
	php: UniversalPHP,
	root: string,
	{
		relativePaths = true,
		pathPrefix,
		exceptPaths = [],
	}: IteratePhpFilesOptions = {}
): AsyncGenerator<File> {
	root = normalizePath(root);
	const stack: string[] = [root];
	while (stack.length) {
		const currentParent = stack.pop();
		if (!currentParent) {
			return;
		}
		const files = await php.listFiles(currentParent);
		for (const file of files) {
			const absPath = `${currentParent}/${file}`;
			if (exceptPaths.includes(absPath.substring(root.length + 1))) {
				continue;
			}
			const isDir = await php.isDir(absPath);
			if (isDir) {
				stack.push(absPath);
			} else {
				yield new StreamedFile(
					streamReadFileFromPHP(php, absPath),
					relativePaths
						? joinPaths(
								pathPrefix || '',
								absPath.substring(root.length + 1)
						  )
						: absPath
				);
			}
		}
	}
}
