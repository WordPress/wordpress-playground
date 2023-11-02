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

export type MemfsJournal = ReturnType<typeof journalMemfs>;

export function journalMemfs(
	php: BasePHP,
	memfsRoot: string,
	onEntry: (entry: FilesystemOperation) => void = () => {}
) {
	memfsRoot = normalizeMemfsPath(memfsRoot);
	const FS = php[__private__dont__use].FS;
	const MEMFS = FS.filesystems.MEMFS;

	// Bind the journal to the filesystem
	const originalWrite = FS.write;
	FS.write = function (stream: EmscriptenFSStream, ...rest: any[]) {
		addEntry({
			operation: 'UPDATE_FILE',
			path: stream.path,
		});
		return originalWrite(stream, ...rest);
	};

	const originalRename = MEMFS.ops_table.dir.node.rename;
	MEMFS.ops_table.dir.node.rename = function (
		old_node: EmscriptenFSNode,
		new_dir: EmscriptenFSNode,
		new_name: string,
		...rest: any[]
	) {
		const old_path = FS.getPath(old_node);
		const new_path = joinPaths(FS.getPath(new_dir), new_name);
		addEntry({
			operation: 'RENAME',
			nodeType: FS.isDir(old_node.mode) ? 'directory' : 'file',
			path: old_path,
			toPath: new_path,
		});
		return originalWrite(old_node, new_dir, new_name, ...rest);
	};

	const originalTruncate = FS.truncate;
	FS.truncate = function (path: string, ...rest: any[]) {
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
		return originalTruncate(path, ...rest);
	};

	const originalUnlink = FS.unlink;
	FS.unlink = function (path: string, ...rest: any[]) {
		addEntry({
			operation: 'DELETE',
			path,
			nodeType: 'file',
		});
		return originalUnlink(path, ...rest);
	};

	const originalMknod = FS.mknod;
	FS.mknod = function (path: string, mode: number, ...rest: any[]) {
		if (FS.isFile(mode)) {
			addEntry({
				operation: 'CREATE',
				path,
				nodeType: 'file',
			});
		}
		return originalMknod(path, mode, ...rest);
	};

	const originalMkdir = FS.mkdir;
	FS.mkdir = function (path: string, ...rest: any[]) {
		addEntry({
			operation: 'CREATE',
			path,
			nodeType: 'directory',
		});
		return originalMkdir(path, ...rest);
	};

	const originalRmdir = FS.rmdir;
	FS.rmdir = function (path: string, ...rest: any[]) {
		addEntry({
			operation: 'DELETE',
			path,
			nodeType: 'directory',
		});
		return originalRmdir(path, ...rest);
	};

	function addEntry(entry: FilesystemOperation) {
		// Only journal entries inside the specified root directory.
		if (!entry.path.startsWith(memfsRoot) || entry.path === memfsRoot) {
			return;
		}
		journal.entries.push(entry);
		onEntry(entry);
	}

	const journal = {
		entries: [{ operation: 'NOOP', path: '' }] as FilesystemOperation[],
		size() {
			return journal.entries.length;
		},
		flush(): FilesystemOperation[] {
			// Remove the NOOP partition
			const entries = journal.entries.slice(1);
			journal.entries = [{ operation: 'NOOP', path: '' }];
			return entries;
		},
		unbind() {
			FS.write = originalWrite;
			MEMFS.ops_table.dir.node.rename = originalRename;
			FS.truncate = originalTruncate;
			FS.unlink = originalUnlink;
			FS.mkdir = originalMkdir;
			FS.rmdir = originalRmdir;
			FS.hasJournal = false;
		},
	};
	return journal;
}

function normalizeMemfsPath(path: string) {
	return path.replace(/\/$/, '').replace(/\/\/+/g, '/');
}

/**
 * Rewrites a list of Filesystem operations to achieve the same
 * result in less steps.
 *
 * For example, if a file is first created and then deleted, both
 * operations can be skipped.
 *
 * @param ops A lengthy list of filesystem operations.
 * @returns Normalized list of filesystem operations.
 */
export function normalize(ops: FilesystemOperation[]): FilesystemOperation[] {
	// Skip creating files that are later removed.
	const createdFiles = new Map<string, FilesystemOperation>();
	const opsToRemove = new Set();
	for (const op of ops) {
		if (op.operation === 'CREATE' && op.nodeType === 'file') {
			createdFiles.set(op.path, op);
		} else if (
			op.operation === 'RENAME' &&
			createdFiles.has(op.path) &&
			op.nodeType === 'file'
		) {
			createdFiles.set(op.toPath, op);
		} else if (
			op.operation === 'DELETE' &&
			createdFiles.has(op.path) &&
			op.nodeType === 'file'
		) {
			opsToRemove.add(op);

			let currentPath = op.path;
			while (createdFiles.has(currentPath)) {
				const removedOp = createdFiles.get(currentPath);
				opsToRemove.add(removedOp);
				createdFiles.delete(currentPath);
				if (removedOp!.operation === 'RENAME') {
					currentPath = removedOp!.path;
				}
			}
		}
	}
	return ops.filter((op) => !opsToRemove.has(op));
}

export type FileSystem = {
	type: FSNodeType;
	implicit?: boolean;
	implicitNodeOperation?: FilesystemOperation['operation'];
	children?: Record<string, FileSystem>;
	contents?: string | Uint8Array;
};

export function normalizeOperations(
	operations: FilesystemOperation[]
): FilesystemOperation[] {
	const fileSystem: FileSystem = {
		type: 'directory',
		children: {},
	};

	function getName(path: string) {
		return path.split('/').pop() || '';
	}

	function getParent(path: string) {
		const parts = path.split('/');
		let current: FileSystem = fileSystem;
		for (const part of parts.slice(0, -1)) {
			if (!current.children) current.children = {};
			if (!current.children[part]) {
				current.children[part] = {
					type: 'directory',
					implicit: true,
					children: {},
				};
			}
			current = current.children[part];
		}
		return current;
	}

	for (const op of operations) {
		switch (op.operation) {
			case 'UPDATE_FILE':
			case 'CREATE': {
				const parent = getParent(op.path);
				const name = getName(op.path);
				parent['children']![name] =
					'nodeType' in op && op.nodeType === 'directory'
						? {
								type: 'directory',
								children: {},
						  }
						: {
								type: 'file',
								contents: '',
						  };
				break;
			}
			case 'DELETE': {
				const parent = getParent(op.path);
				const name = getName(op.path);
				if (!(name in parent.children!)) {
					// A node that implicitly exists in the original Filesystem, but
					// haven't been mentioned in the stream of operations.
					parent.children![name] = {
						type: op.nodeType,
						implicit: true,
						implicitNodeOperation: op.operation,
					};
				} else {
					// A node that was explicitly created in the stream of operations.
					delete parent.children![name];
				}
				break;
			}
			case 'RENAME': {
				const fromParent = getParent(op.path);
				const fromName = getName(op.path);
				const toParent = getParent(op.toPath);
				const toName = getName(op.toPath);
				toParent.children![toName] = fromParent.children![fromName];
				delete fromParent.children![fromName];
				break;
			}
			default:
				console.error('Unknown operation type:', op.operation);
		}
	}

	const normalizedOps: FilesystemOperation[] = [];
	function traverse(path: string, node: FileSystem) {
		if (node.implicit) {
			if (node.implicitNodeOperation === 'DELETE') {
				normalizedOps.push({
					operation: 'DELETE',
					path,
					nodeType: node.type,
				});
			}
		} else if (node.type === 'file') {
			normalizedOps.push({
				operation: 'UPDATE_FILE',
				path,
			});
		} else if (node.type === 'directory') {
			normalizedOps.push({
				operation: 'CREATE',
				path,
				nodeType: 'directory',
			});
		}

		if (node.type === 'directory') {
			for (const [name, child] of Object.entries(node.children || {})) {
				traverse(`${path}/${name}`, child as FileSystem);
			}
		}
	}

	for (const [name, node] of Object.entries(fileSystem.children!)) {
		traverse(name, node as FileSystem);
	}

	return normalizedOps;
}
