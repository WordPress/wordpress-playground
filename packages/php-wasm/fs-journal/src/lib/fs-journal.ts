import { PHP, UniversalPHP, __private__dont__use } from '@php-wasm/universal';
import type { IsomorphicLocalPHP } from '@php-wasm/universal';
import { Semaphore, basename, joinPaths } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';

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

export type FilesystemOperation =
	| CreateOperation
	| UpdateFileOperation
	| DeleteOperation
	| RenameOperation;

export function journalFSEvents(
	php: PHP,
	fsRoot: string,
	onEntry: (entry: FilesystemOperation) => void = () => {}
) {
	function bindToCurrentRuntime() {
		fsRoot = normalizePath(fsRoot);
		const FS = php[__private__dont__use].FS;
		const FSHooks = createFSHooks(FS, (entry: FilesystemOperation) => {
			// Only journal entries inside the specified root directory.
			if (entry.path.startsWith(fsRoot)) {
				onEntry(entry);
			} else if (
				entry.operation === 'RENAME' &&
				entry.toPath.startsWith(fsRoot)
			) {
				for (const op of recordExistingPath(
					php,
					entry.path,
					entry.toPath
				)) {
					onEntry(op);
				}
			}
		});

		/**
		 * Override the original FS functions with ones running the hooks.
		 * We could use a Proxy object here if the Emscripten JavaScript module
		 * did not use hard-coded references to the FS object.
		 */
		const originalFunctions: Record<string, Function> = {};
		for (const [name] of Object.entries(FSHooks)) {
			originalFunctions[name] = FS[name];
		}

		// eslint-disable-next-line no-inner-declarations
		function bind() {
			for (const [name, hook] of Object.entries(FSHooks)) {
				FS[name] = function (...args: any[]) {
					// @ts-ignore
					hook(...args);
					return originalFunctions[name].apply(this, args);
				};
			}
		}
		// eslint-disable-next-line no-inner-declarations
		function unbind() {
			// Restore the original FS functions.
			for (const [name, fn] of Object.entries(originalFunctions)) {
				php[__private__dont__use].FS[name] = fn;
			}
		}

		php[__private__dont__use].journal = {
			bind,
			unbind,
		};
		bind();
	}
	php.addEventListener('runtime.initialized', bindToCurrentRuntime);
	if (php[__private__dont__use]) {
		bindToCurrentRuntime();
	}

	function unbindFromOldRuntime() {
		php[__private__dont__use].journal.unbind();
		delete php[__private__dont__use].journal;
	}
	php.addEventListener('runtime.beforedestroy', unbindFromOldRuntime);

	return function unbind() {
		php.removeEventListener('runtime.initialized', bindToCurrentRuntime);
		php.removeEventListener('runtime.beforedestroy', unbindFromOldRuntime);
		return php[__private__dont__use].journal.unbind();
	};
}

const createFSHooks = (
	FS: EmscriptenFS,
	recordEntry: (entry: FilesystemOperation) => void = () => {}
) => ({
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
				nodeType: FS.isDir(oldLookup.node.mode) ? 'directory' : 'file',
				path: oldLookup.path,
				toPath: joinPaths(newParentPath, basename(new_path)),
			});
		} catch (e) {
			// We're running a bunch of FS lookups that may fail at this point.
			// Let's ignore the failures and let the actual rename operation
			// fail if it needs to.
		}
	},
});

/**
 * Replays a list of filesystem operations on a PHP instance.
 *
 * @param php
 * @param entries
 */
export function replayFSJournal(php: PHP, entries: FilesystemOperation[]) {
	// We need to restore the original functions to the FS object
	// before proceeding, or each replayed FS operation will be journaled.
	//
	// Unfortunately we can't just call the non-journaling versions directly,
	// because they call other low-level FS functions like `FS.mkdir()`
	// and will trigger the journaling hooks anyway.
	php[__private__dont__use].journal.unbind();
	try {
		for (const entry of entries) {
			if (entry.operation === 'CREATE') {
				if (entry.nodeType === 'file') {
					php.writeFile(entry.path, ' ');
				} else {
					php.mkdir(entry.path);
				}
			} else if (entry.operation === 'DELETE') {
				if (entry.nodeType === 'file') {
					php.unlink(entry.path);
				} else {
					php.rmdir(entry.path);
				}
			} else if (entry.operation === 'WRITE') {
				php.writeFile(entry.path, entry.data!);
			} else if (entry.operation === 'RENAME') {
				php.mv(entry.path, entry.toPath);
			}
		}
	} finally {
		php[__private__dont__use].journal.bind();
	}
}

export function* recordExistingPath(
	php: IsomorphicLocalPHP,
	fromPath: string,
	toPath: string
): Generator<FilesystemOperation> {
	if (php.isDir(fromPath)) {
		// The rename operation moved a directory from outside root directory
		// into the root directory. We need to traverse the entire tree
		// and provide a create operation for each file and directory.
		yield {
			operation: 'CREATE',
			path: toPath,
			nodeType: 'directory',
		};
		for (const file of php.listFiles(fromPath)) {
			yield* recordExistingPath(
				php,
				joinPaths(fromPath, file),
				joinPaths(toPath, file)
			);
		}
	} else {
		// The rename operation moved a file from outside root directory
		// into the root directory. Let's rewrite it as a create operation.
		yield {
			operation: 'CREATE',
			path: toPath,
			nodeType: 'file',
		};
		yield {
			operation: 'WRITE',
			nodeType: 'file',
			path: toPath,
		};
	}
}

function normalizePath(path: string) {
	return path.replace(/\/$/, '').replace(/\/\/+/g, '/');
}

/**
 * Normalizes a list of filesystem operations to remove
 * redundant operations.
 *
 * This is crucial because the journal doesn't store the file contents
 * on write, but only the information that the write happened. We only
 * read the contents of the file on flush. However, at that time the file
 * could have been moved to another location so we need this function to
 * rewrite the journal to reflect the current file location. Only then
 * will the hydrateUpdateFileOps() function be able to do its job.
 *
 * @param journal The original journal.
 * @returns The normalized journal.
 */
export function normalizeFilesystemOperations(
	journal: FilesystemOperation[]
): FilesystemOperation[] {
	const substitutions: Record<number, any> = {};
	for (let i = journal.length - 1; i >= 0; i--) {
		for (let j = i - 1; j >= 0; j--) {
			const formerType = checkRelationship(journal[i], journal[j]);
			if (formerType === 'none') {
				continue;
			}

			const latter = journal[i];
			const former = journal[j];
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
				logger.warn(
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
						substitutions[j] = [];
						substitutions[i] = [
							{
								...former,
								path: latter.toPath,
							},
							...(substitutions[i] || []),
						];
					} else if (formerType === 'descendant') {
						// Creating a node and then renaming its parent directory is equivalent
						// to creating it in the new location.
						substitutions[j] = [];
						substitutions[i] = [
							{
								...former,
								path: joinPaths(
									latter.toPath,
									former.path.substring(latter.path.length)
								),
							},
							...(substitutions[i] || []),
						];
					}
				} else if (
					latter.operation === 'WRITE' &&
					formerType === 'same_node'
				) {
					// Updating the same node twice is equivalent to updating it once
					// at the later time.
					substitutions[j] = [];
				} else if (
					latter.operation === 'DELETE' &&
					formerType === 'same_node'
				) {
					// Creating a node and then deleting it is equivalent to doing nothing.
					substitutions[j] = [];
					substitutions[i] = [];
				}
			}
		}
		// Any substiturions? Apply them and and start over.
		// We can't just continue as the current operation may
		// have been replaced.
		if (Object.entries(substitutions).length > 0) {
			const updated = journal.flatMap((op, index) => {
				if (!(index in substitutions)) {
					return [op];
				}
				return substitutions[index];
			});
			return normalizeFilesystemOperations(updated);
		}
	}
	return journal;
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
	return 'none';
}

/**
 * Populates each WRITE operation with the contents of
 * said file.
 *
 * Mutates the original array.
 *
 * @param php
 * @param entries
 */
export async function hydrateUpdateFileOps(
	php: UniversalPHP,
	entries: FilesystemOperation[]
) {
	const updateFileOps = entries.filter(
		(op): op is UpdateFileOperation => op.operation === 'WRITE'
	);
	const updates = updateFileOps.map((op) => hydrateOp(php, op));
	await Promise.all(updates);
	return entries;
}

const hydrateLock = new Semaphore({ concurrency: 15 });
async function hydrateOp(php: UniversalPHP, op: UpdateFileOperation) {
	const release = await hydrateLock.acquire();

	// There is a race condition here:
	// The file could have been removed from the filesystem
	// between the flush() call and now. If that happens, we won't
	// be able to read it here.
	//
	// If the file was DELETEd, we're fine as the next flush() will
	// propagate the DELETE operation.
	//
	// If the file was RENAMEd, we're in trouble as we're about to
	// tell the other peer to create an empty file and the next
	// flush() will rename that empty file.
	//
	// This issue requires a particular timing and is unlikely to ever happen,
	// but is definitely possible. We could mitigate it by either:
	//
	// * Peeking into the buffered journal entries since the last flush() to
	//   source the file path from
	// * Storing the data at the journaling stage instead of the flush() stage,
	//   (and using potentially a lot of additional memory to keep track of all
	//    the intermediate stages)
	//
	// For now, htough, let's just add error logging and keep an eye on this
	// to see if this actually ever happens.
	try {
		op.data = await php.readFileAsBuffer(op.path);
	} catch (e) {
		// Log the error but don't throw.
		logger.warn(
			`Journal failed to hydrate a file on flush: the ` +
				`path ${op.path} no longer exists`
		);
		logger.error(e);
	}

	release();
}
