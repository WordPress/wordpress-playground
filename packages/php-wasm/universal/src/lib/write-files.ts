import { dirname, joinPaths } from '@php-wasm/util';
import { UniversalPHP } from './universal-php';

interface WriteFilesOptions {
	rmRoot?: boolean;
}

/**
 * Replaces the contents of a Playground directory with the given files.
 *
 * @param php
 * @param root
 * @param newFiles
 */
export async function writeFiles(
	php: UniversalPHP,
	root: string,
	newFiles: Record<string, Uint8Array | string>,
	{ rmRoot = false }: WriteFilesOptions = {}
) {
	if (rmRoot) {
		if (await php.isDir(root)) {
			await php.rmdir(root, { recursive: true });
		}
	}
	for (const [relativePath, content] of Object.entries(newFiles)) {
		const filePath = joinPaths(root, relativePath);
		if (!(await php.fileExists(dirname(filePath)))) {
			await php.mkdir(dirname(filePath));
		}
		await php.writeFile(filePath, content);
	}
}
