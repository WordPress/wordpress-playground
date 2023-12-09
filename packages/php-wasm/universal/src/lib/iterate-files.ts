import { dirname, joinPaths, normalizePath } from '@php-wasm/util';
import { UniversalPHP } from './universal-php';

export type FileEntry = {
	path: string;
	isDirectory?: boolean;
	read: () => Promise<Uint8Array>;
};

export type IterateFilesOptions = {
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
export async function* iterateFiles(
	php: UniversalPHP,
	root: string,
	{
		relativePaths = true,
		pathPrefix,
		exceptPaths = [],
	}: IterateFilesOptions = {}
): AsyncGenerator<FileEntry> {
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
				yield {
					path: relativePaths
						? joinPaths(
								pathPrefix || '',
								absPath.substring(root.length + 1)
						  )
						: absPath,
					read: async () => await php.readFileAsBuffer(absPath),
				};
			}
		}
	}
}

export async function readAllBytes(
	reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<Uint8Array> {
	let size = 0;
	const chunks: Uint8Array[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		chunks.push(value);
		size += value.length;
	}
	const result = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}
	return result;
}

/**
 * Replaces the contents of a Playground directory with the given files.
 *
 * @param client
 * @param root
 * @param newFiles
 */
export async function writeToPath(
	client: UniversalPHP,
	root: string,
	files: AsyncIterable<FileEntry>
) {
	await client.mkdir(root);
	for await (const file of files) {
		const filePath = joinPaths(root, file.path);
		if (file.isDirectory) {
			await client.mkdir(filePath);
		} else {
			await client.mkdir(dirname(filePath));
			await client.writeFile(filePath, await file.read());
		}
	}
}
