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
	filesBefore: AsyncIterable<File>,
	filesAfter: AsyncIterable<File>
) {
	const filesBeforeMap = new Map<string, Uint8Array>();
	for await (const fileBefore of filesBefore) {
		filesBeforeMap.set(
			fileBefore.name,
			new Uint8Array(await fileBefore.arrayBuffer())
		);
	}
	const changes: Changeset = {
		create: new Map(),
		update: new Map(),
		delete: new Set(),
	};

	const seenFilesAfter = new Set<string>();
	for await (const fileAfter of filesAfter) {
		seenFilesAfter.add(fileAfter.name);

		const before = filesBeforeMap.get(fileAfter.name);
		const after = new Uint8Array(await fileAfter.arrayBuffer());
		if (before) {
			if (!uint8arraysEqual(before, after)) {
				changes.update.set(fileAfter.name, after);
			}
		} else {
			changes.create.set(fileAfter.name, after);
		}
	}

	for (const pathBefore of filesBeforeMap.keys()) {
		if (!seenFilesAfter.has(pathBefore)) {
			changes.delete.add(pathBefore);
		}
	}

	return changes;
}

function uint8arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
	return a.length === b.length && a.every((val, index) => val === b[index]);
}
