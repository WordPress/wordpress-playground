import { BasePHP, __private__dont__use } from '@php-wasm/universal';
import type { IsomorphicLocalPHP } from '@php-wasm/universal';
import { basename, joinPaths } from '@php-wasm/util';

export type EmscriptenFS = any;

/**
 * Represents a stream in the Emscripten file system.
 */
export type EmscriptenFSStream = {
	/** The path of the node associated with this stream. */
	path: string;
	/** The node associated with the stream. */
	node: EmscriptenFSNode;
};

/**
 * Represents a node in the Emscripten file system.
 */
export type EmscriptenFSNode = {
	/**
	 * The name of the file or directory.
	 */
	name: string;
	/**
	 * A binary flag encoding information about this note,
	 * e.g. whether it's file or a directory.
	 */
	mode: number;
	/**
	 * A dictionary of functions representing operations
	 * that can be performed on the node.
	 */
	node_ops: any;
};

/**
 * Represents the type of node in PHP file system.
 */
export type FSNodeType = 'file' | 'directory';

/**
 * Represents an update operation on a file system node.
 */
export type UpdateFileOperation = {
	/** The type of operation being performed. */
	operation: 'WRITE';
	/** The path of the node being updated. */
	path: string;
	/** Optional. The new contents of the file. */
	data?: Uint8Array;
	nodeType: 'file';
};

/**
 * Represents a directory operation.
 */
export type CreateOperation = {
	/** The type of operation being performed. */
	operation: 'CREATE';
	/** The path of the node being created. */
	path: string;
	/** The type of the node being created. */
	nodeType: FSNodeType;
};

export type DeleteOperation = {
	/** The type of operation being performed. */
	operation: 'DELETE';
	/** The path of the node being updated. */
	path: string;
	/** The type of the node being updated. */
	nodeType: FSNodeType;
};

/**
 * Represents a rename operation on a file or directory in PHP file system.
 */
export type RenameOperation = {
	/** The type of operation being performed. */
	operation: 'RENAME';
	/** The original path of the file or directory being renamed. */
	path: string;
	/** The new path of the file or directory after the rename operation. */
	toPath: string;
	/** The type of node being renamed (file or directory). */
	nodeType: FSNodeType;
};

/**
 * Represents a node in the file system.
 */
export type FSNode = {
	/** The name of this file or directory. */
	name: string;
	/** The type of this node (file or directory). */
	type: FSNodeType;
	/** The contents of the file, if it is a file and it's stored in memory. */
	contents?: string;
	/** The child nodes of the directory, if it is a directory. */
	children?: FSNode[];
};

export type FilesystemOperation = (
	| CreateOperation
	| UpdateFileOperation
	| DeleteOperation
	| RenameOperation
) & {
	__remove?: boolean;
};

export function journalFSEvents(
	php: BasePHP,
	fsRoot: string,
	onEntry: (entry: FilesystemOperation) => void = () => {}
) {
	fsRoot = normalizePath(fsRoot);
	const FS = php[__private__dont__use].FS;

	const FSHooks: Record<string, Function> = {
		write(stream: EmscriptenFSStream) {
			recordEntry({
				operation: 'WRITE',
				path: stream.path,
				nodeType: 'file',
			});
		},
		truncate(path: string) {
			let node;
			if (typeof path == 'string') {
				const lookup = FS.lookupPath(path, {
					follow: true,
				});
				node = lookup.node;
			} else {
				node = path;
			}
			recordEntry({
				operation: 'WRITE',
				path: FS.getPath(node),
				nodeType: 'file',
			});
		},
		unlink(path: string) {
			recordEntry({
				operation: 'DELETE',
				path,
				nodeType: 'file',
			});
		},
		mknod(path: string, mode: number) {
			if (FS.isFile(mode)) {
				recordEntry({
					operation: 'CREATE',
					path,
					nodeType: 'file',
				});
			}
		},
		mkdir(path: string) {
			recordEntry({
				operation: 'CREATE',
				path,
				nodeType: 'directory',
			});
		},
		rmdir(path: string) {
			recordEntry({
				operation: 'DELETE',
				path,
				nodeType: 'directory',
			});
		},
		rename(old_path: string, new_path: string) {
			try {
				const oldLookup = FS.lookupPath(old_path, {
					follow: true,
				});
				const newParentPath = FS.lookupPath(new_path, {
					parent: true,
				}).path;

				recordEntry({
					operation: 'RENAME',
					nodeType: FS.isDir(oldLookup.node.mode)
						? 'directory'
						: 'file',
					path: oldLookup.path,
					toPath: joinPaths(newParentPath, basename(new_path)),
				});
			} catch (e) {
				// We're running a bunch of FS lookups that may fail at this point.
				// Let's ignore the failures and let the actual rename operation
				// fail if it needs to.
			}
		},
	};

	function recordEntry(entry: FilesystemOperation) {
		// Only journal entries inside the specified root directory.
		if (entry.path.startsWith(fsRoot)) {
			onEntry(entry);
		} else if (
			entry.operation === 'RENAME' &&
			entry.toPath.startsWith(fsRoot)
		) {
			for (const op of recordExistingPath(php, entry.toPath)) {
				onEntry(op);
			}
		}
	}

	/**
	 * Override the original FS functions with ones running the hooks.
	 * We could use a Proxy object here if the Emscripten JavaScript module
	 * did not use hard-coded references to the FS object.
	 */
	const originalFunctions: Record<string, Function> = {};
	for (const [name, hook] of Object.entries(FSHooks)) {
		originalFunctions[name] = FS[name];
		FS[name] = function (...args: any[]) {
			if (php.journalingAllowed) {
				hook(...args);
			}
			return originalFunctions[name].apply(this, args);
		};
	}
	php.journalingAllowed = true;

	return function unbind() {
		// Restore the original FS functions.
		for (const [name, fn] of Object.entries(originalFunctions)) {
			php[__private__dont__use].FS[name] = fn;
			delete originalFunctions[name];
		}
	};
}

export function* recordExistingPath(
	php: IsomorphicLocalPHP,
	path: string
): Generator<FilesystemOperation> {
	if (php.isDir(path)) {
		// The rename operation moved a directory from outside root directory
		// into the root directory. We need to traverse the entire tree
		// and provide a create operation for each file and directory.
		yield {
			operation: 'CREATE',
			path: path,
			nodeType: 'directory',
		};
		for (const file of php.listFiles(path)) {
			const filePath = joinPaths(path, file);
			yield* recordExistingPath(php, filePath);
		}
	} else {
		// The rename operation moved a file from outside root directory
		// into the root directory. Let's rewrite it as a create operation.
		yield {
			operation: 'CREATE',
			path,
			nodeType: 'file',
		};
		yield {
			operation: 'WRITE',
			nodeType: 'file',
			path,
		};
	}
}

function normalizePath(path: string) {
	return path.replace(/\/$/, '').replace(/\/\/+/g, '/');
}

export function normalizeFilesystemOperations(
	originalJournal: FilesystemOperation[]
): FilesystemOperation[] {
	let changed;
	let rev: FilesystemOperation[] = [...originalJournal].reverse();
	do {
		changed = false;
		for (let i = 0; i < rev.length; i++) {
			const accumulatedOps: FilesystemOperation[] = [];
			for (let j = i + 1; j < rev.length; j++) {
				const formerType = checkRelationship(rev[i], rev[j]);
				if (formerType === 'none') {
					continue;
				}

				const latter = rev[i];
				const former = rev[j];
				if (
					latter.operation === 'RENAME' &&
					former.operation === 'RENAME'
				) {
					// Normalizing a double rename is a complex scenario so let's just give up.
					// There's just too many possible scenarios to handle.
					//
					// For example, the following scenario may not be possible to normalize:
					// RENAME /dir_a /dir_b
					// RENAME /dir_b/subdir /dir_c
					// RENAME /dir_b /dir_d
					//
					// Similarly, how should we normalize the following list?
					// CREATE_FILE /file
					// CREATE_DIR /dir_a
					// RENAME /file /dir_a/file
					// RENAME /dir_a /dir_b
					// RENAME /dir_b/file /dir_b/file_2
					//
					// The shortest way to recreate the same structure would be this:
					// CREATE_DIR /dir_b
					// CREATE_FILE /dir_b/file_2
					//
					// But that's not a straightforward transformation so let's just not handle
					// it for now.
					console.warn(
						'[FS Journal] Normalizing a double rename is not yet supported:',
						{
							current: latter,
							last: former,
						}
					);
					continue;
				}

				if (former.operation === 'CREATE' || former.operation === 'WRITE') {
					if (latter.operation === 'RENAME') {
						if (formerType === 'same_node') {
							// Creating a node and then renaming it is equivalent to creating it in
							// the new location.
							rev.splice(j, 1);
							j -= 1;
							accumulatedOps.push({
								...former,
								path: latter.toPath,
							});
							latter.__remove = true;
							changed = true;
							continue;
						}

						if (formerType === 'descendant') {
							// Creating a node and then renaming its parent directory is equivalent
							// to creating it in the new location.
							rev.splice(j, 1);
							j -= 1;
							accumulatedOps.push({
								...former,
								path: joinPaths(
									latter.toPath,
									former.path.substring(latter.path.length)
								),
							});
							changed = true;
							continue;
						}
					} else if (
						latter.operation === 'WRITE' &&
						formerType === 'same_node'
					) {
						// Updating the same node twice is equivalent to updating it once
						// at the later time.
						rev.splice(j, 1);
						j -= 1;
						changed = true;
						continue;
					} else if (
						latter.operation === 'DELETE' &&
						formerType === 'same_node'
					) {
						// Creating a node and then deleting it is equivalent to doing nothing.
						rev.splice(j, 1);
						j -= 1;
						latter.__remove = true;
						changed = true;
						continue;
					}
				}
			}
			rev.splice(i, 0, ...accumulatedOps);
		}
		rev = rev.filter((op) => !op.__remove);
	} while(changed);
	return rev.reverse();
}

type RelatedOperationInfo = 'same_node' | 'ancestor' | 'descendant' | 'none';
function checkRelationship(
	latter: FilesystemOperation,
	former: FilesystemOperation
): RelatedOperationInfo {
	const latterPath = latter.path;
	const latterIsDir =
		latter.operation !== 'WRITE' && latter.nodeType === 'directory';
	const formerIsDir =
		former.operation !== 'WRITE' && former.nodeType === 'directory';
	const formerPath =
		former.operation === 'RENAME' ? former.toPath : former.path;

	if (formerPath === latterPath) {
		return 'same_node';
	} else if (formerIsDir && latterPath.startsWith(formerPath + '/')) {
		return 'ancestor';
	} else if (latterIsDir && formerPath.startsWith(latterPath + '/')) {
		return 'descendant';
	}
	// console.log({
	// 	cmpPath: formerPath,
	// 	refPath: latterPath,
	// 	cmpIsDir: formerIsDir,
	// 	refIsDir: latterIsDir,
	// });
	return 'none';
}

// /**
//  * Populates in-place each WRITE operation with the contents of
//  * said file.
//  *
//  * Memory bloat caveats:
//  * * If a file was created and then renamed, this function
//  *   will populate both the original file and the renamed file.
//  * * If a file was created and then removed, this function
//  *   will still populate the original file.
//  *
//  * To avoid these caveats, we may need to implement a function like
//  * `normalizeFilesystemOperations` to only leave one relevant operation
//  * per file.
//  *
//  * @param php
//  * @param entries
//  */
// const hydrateLock = new Semaphore({ concurrency: 15 });
// export async function hydrateUpdateFileOps(php: BasePHP, entries: FilesystemOperation[]) {
// 	for (const entry of entries) {
// 		if(entry.operation === 'WRITE') {
// 			await hydrateLock.acquire();
// 			try {

// 			}
// 				hydrateUpdateFileOp(php, entry).finally(release);
// 			});
// 		}
// 	}

// 	if (entry.operation === 'WRITE') {
// 		// @TODO: If the file was removed in the meantime, we won't
// 		// be able to read it. We can't easily provide the contents
// 		// with the operation because it would create a ton of partial
// 		// content copies on each write. It seems like the only way
// 		// to solve this is to have a function like "normalizeFilesystemOperations"
// 		// that would prune the list of operations and merge them together as needed.
// 		try {
// 			entry.data = await playground.readFileAsBuffer(entry.path);
// 		} catch (e) {
// 			// Log the error but don't throw.
// 			console.error(e);
// 		}
// 	}
// }
