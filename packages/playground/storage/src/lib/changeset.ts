import { UniversalPHP } from '@php-wasm/universal';
import { joinPaths, normalizePath } from '@php-wasm/util';

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
};

/**
 * Iterates over all files in a Playground directory and its subdirectories.
 *
 * @param playground - The Playground/PHP instance.
 * @param root - The root directory to start iterating from.
 * @param options - Optional configuration.
 * @returns All files found in the tree.
 */
export async function* iterateFiles(
	playground: UniversalPHP,
	root: string,
	{ relativePaths = true, pathPrefix }: IterateFilesOptions = {}
): AsyncGenerator<FileEntry> {
	root = normalizePath(root);
	const stack: string[] = [root];
	while (stack.length) {
		const currentParent = stack.pop();
		if (!currentParent) {
			return;
		}
		const files = await playground.listFiles(currentParent);
		for (const file of files) {
			const absPath = `${currentParent}/${file}`;
			const isDir = await playground.isDir(absPath);
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
					read: async () =>
						await playground.readFileAsBuffer(absPath),
				};
			}
		}
	}
}

export type FileEntry = {
	path: string;
	read: () => Promise<Uint8Array>;
};

/**
 * Represents a set of changes to be applied to a data store.
 */
export type Changeset = {
	/**
	 * Created files.
	 */
	create: Map<string, Uint8Array>;

	/**
	 * Updated files.
	 */
	update: Map<string, Uint8Array>;

	/**
	 * Deleted files.
	 */
	delete: Set<string>;
};

/**
 * Compares two sets of files and returns a changeset object that describes
 * the differences between them.
 *
 * @param filesBefore - A map of file paths to Uint8Array objects representing the contents
 *                      of the files before the changes.
 * @param filesAfter - An async generator that yields FileEntry objects representing the files
 *                     after the changes.
 * @returns A changeset object that describes the differences between the two sets of files.
 */
export async function changeset(
	filesBefore: Map<string, Uint8Array>,
	filesAfter: AsyncGenerator<FileEntry>
) {
	const changes: Changeset = {
		create: new Map(),
		update: new Map(),
		delete: new Set(),
	};

	const seenFilesAfter = new Set<string>();
	for await (const fileAfter of filesAfter) {
		seenFilesAfter.add(fileAfter.path);

		const before = filesBefore.get(fileAfter.path);
		const after = await fileAfter.read();
		if (before) {
			if (!uint8arraysEqual(before, after)) {
				changes.update.set(fileAfter.path, after);
			}
		} else {
			changes.create.set(fileAfter.path, after);
		}
	}

	for (const pathBefore of filesBefore.keys()) {
		if (!seenFilesAfter.has(pathBefore)) {
			changes.delete.add(pathBefore);
		}
	}

	return changes;
}

function uint8arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
	return a.length === b.length && a.every((val, index) => val === b[index]);
}
