import { BasePHP, __private__dont__use } from './base-php';
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
	operation: 'UPDATE_FILE';
	/** The path of the node being updated. */
	path: string;
	/** Optional. The new contents of the file. */
	data?: Uint8Array;
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
 * Represents a node in the in-memory file system.
 */
export type FSNode = {
	/** The name of this file or directory. */
	name: string;
	/** The type of this node (file or directory). */
	type: FSNodeType;
	/** The contents of the file, if it is a file. */
	contents?: string;
	/** The child nodes of the directory, if it is a directory. */
	children?: FSNode[];
};

export type FilesystemOperation =
	| CreateOperation
	| UpdateFileOperation
	| DeleteOperation
	| RenameOperation;

declare module './universal-php' {
	export interface IsomorphicLocalPHP {
		__journalingDisabled?: boolean;
	}
}

declare module './base-php' {
	export interface BasePHP {
		__journalingDisabled?: boolean;
	}
}

export function journalMemfs(
	php: BasePHP,
	memfsRoot: string,
	onEntry: (entry: FilesystemOperation) => void = () => {}
) {
	const FSHooks: Record<string, Function> = {
		write(stream: EmscriptenFSStream) {
			recordEntry({
				operation: 'UPDATE_FILE',
				path: stream.path,
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
				operation: 'UPDATE_FILE',
				path: FS.getPath(node),
			});
		},
		unlink(path: string) {
			recordEntry({
				operation: 'DELETE',
				path,
				nodeType: 'file',
			});
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

	memfsRoot = normalizeMemfsPath(memfsRoot);
	function recordEntry(entry: FilesystemOperation) {
		// Only journal entries inside the specified root directory.
		if (entry.path.startsWith(memfsRoot)) {
			onEntry(entry);
		} else if (
			entry.operation === 'RENAME' &&
			entry.toPath.startsWith(memfsRoot)
		) {
			if (entry.nodeType === 'file') {
				// The rename operation moved a file from outside root directory
				// into the root directory. Let's rewrite it as a create operation.
				onEntry({
					operation: 'UPDATE_FILE',
					path: entry.toPath,
				});
			} else {
				// The rename operation moved a directory from outside root directory
				// into the root directory. We need to traverse the entire tree
				// and provide a create operation for each file and directory.
				//
				// This can be done, but for now let's just give up.
				// @TODO implement this
				console.warn(
					`Journaling a rename operation that moved a directory into the root directory is not supported yet.`
				);
			}
		}
	}

	/**
	 * Override the original FS functions with ones running the hooks.
	 * We could use a Proxy object here if the Emscripten JavaScript module
	 * did not use hard-coded references to the FS object.
	 */
	const FS = php[__private__dont__use].FS;
	const originalFunctions: Record<string, Function> = {};
	for (const [name, hook] of Object.entries(FSHooks)) {
		originalFunctions[name] = FS[name];
		FS[name] = function (...args: any[]) {
			if (!php.__journalingDisabled) {
				hook(...args);
			}
			return originalFunctions[name].apply(this, args);
		};
	}

	return function unbind() {
		delete php.__journalingDisabled;
		// Restore the original FS functions.
		for (const [name, fn] of Object.entries(originalFunctions)) {
			php[__private__dont__use].FS[name] = fn;
			delete originalFunctions[name];
		}
	};
}

function normalizeMemfsPath(path: string) {
	return path.replace(/\/$/, '').replace(/\/\/+/g, '/');
}
