import { dirname, resolvePathUnder } from '@php-wasm/util';
import type { UniversalPHP } from './universal-php';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FileTree extends Record<
	string,
	Uint8Array | string | FileTree
> {}

type ResolvedFileTreeFile = [filePath: string, content: Uint8Array | string];

export interface WriteFilesOptions {
	/**
	 * Whether to wipe out the contents of the
	 * root directory before writing the new files.
	 */
	rmRoot?: boolean;
}

/**
 * Writes multiple files to a specified directory in the Playground
 * filesystem.
 *
 * Every key in the file tree must resolve inside the target directory. Paths
 * are validated before any existing files are removed so an invalid nested
 * entry cannot leave the target directory half-cleared.
 *
 * @example ```ts
 * await writeFiles(php, '/test', {
 * 	'file.txt': 'file',
 * 	'sub/file.txt': 'file',
 * 	'sub1/sub2/file.txt': 'file',
 * });
 * ```
 *
 * @param php
 *        The Playground filesystem to write to.
 * @param root
 *        The directory that receives the file tree.
 * @param newFiles
 *        Files and nested directories keyed by relative paths.
 * @param options
 *        Write behavior such as clearing the root first.
 */
export async function writeFiles(
	php: UniversalPHP,
	root: string,
	newFiles: FileTree,
	{ rmRoot = false }: WriteFilesOptions = {}
) {
	const filesToWrite = resolveFileTree(root, newFiles);
	if (rmRoot) {
		if (await php.isDir(root)) {
			await php.rmdir(root, { recursive: true });
		}
	}
	for (const [filePath, content] of filesToWrite) {
		if (!(await php.fileExists(dirname(filePath)))) {
			await php.mkdir(dirname(filePath));
		}
		await php.writeFile(filePath, content);
	}
}

/**
 * Resolves the whole tree before writes so `rmRoot` never clears the target
 * before discovering an invalid nested path.
 */
function resolveFileTree(
	root: string,
	files: FileTree
): ResolvedFileTreeFile[] {
	return Object.entries(files).flatMap(([relativePath, content]) => {
		const filePath = resolvePathUnder(relativePath, root);
		if (!filePath) {
			throw new Error(
				`Invalid file tree path ${JSON.stringify(
					relativePath
				)}: it must resolve inside ${JSON.stringify(root)}.`
			);
		}
		if (content instanceof Uint8Array || typeof content === 'string') {
			return [[filePath, content]];
		}
		return resolveFileTree(filePath, content);
	});
}
