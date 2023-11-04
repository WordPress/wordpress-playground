import { BasePHP, __private__dont__use } from './base-php';
import { joinPaths } from '@php-wasm/util';

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
 * Represents a no-operation operation.
 */
export type NoopOperation = {
	/** The type of operation. */
	operation: 'NOOP';
	/** The path of the operation. */
	path: '';
};

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
	| NoopOperation
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
	memfsRoot = normalizeMemfsPath(memfsRoot);

	const FSHooks: Record<string, Function> = {
		write(stream: EmscriptenFSStream) {
			addEntry({
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
			addEntry({
				operation: 'UPDATE_FILE',
				path: FS.getPath(node),
			});
		},
		unlink(path: string) {
			addEntry({
				operation: 'DELETE',
				path,
				nodeType: 'file',
			});
		},
		mkdir(path: string) {
			addEntry({
				operation: 'CREATE',
				path,
				nodeType: 'file',
			});
		},
		rmdir(path: string) {
			addEntry({
				operation: 'DELETE',
				path,
				nodeType: 'directory',
			});
		},
	};

	function addEntry(entry: FilesystemOperation) {
		// Only journal entries inside the specified root directory.
		if (!entry.path.startsWith(memfsRoot) || entry.path === memfsRoot) {
			return;
		}
		onEntry(entry);
	}

	const FS = php[__private__dont__use].FS;
	const FSwithJournal = new Proxy(FS, {
		get(target, prop, receiver) {
			const originalValue = Reflect.get(target, prop, receiver);
			if (typeof originalValue === 'function') {
				return function (...args: any[]) {
					if (!php.__journalingDisabled && prop in FSHooks) {
						FSHooks[prop as string](...args);
					}
					return originalValue.apply(target, args);
				};
			}
			return originalValue;
		},
	});
	php[__private__dont__use].FS = FSwithJournal;

	const MEMFS = FS.filesystems.MEMFS;
	const originalRename = MEMFS.ops_table.dir.node.rename;
	MEMFS.ops_table.dir.node.rename = function (
		old_node: EmscriptenFSNode,
		new_dir: EmscriptenFSNode,
		new_name: string,
		...rest: any[]
	) {
		if (!php.__journalingDisabled) {
			const old_path = FS.getPath(old_node);
			const new_path = joinPaths(FS.getPath(new_dir), new_name);
			addEntry({
				operation: 'RENAME',
				nodeType: FS.isDir(old_node.mode) ? 'directory' : 'file',
				path: old_path,
				toPath: new_path,
			});
		}
		return originalRename(old_node, new_dir, new_name, ...rest);
	};

	return function unbind() {
		php[__private__dont__use].FS = FS;
		MEMFS.ops_table.dir.node.rename = originalRename;
		FS.hasJournal = false;
	};
}

function normalizeMemfsPath(path: string) {
	return path.replace(/\/$/, '').replace(/\/\/+/g, '/');
}
