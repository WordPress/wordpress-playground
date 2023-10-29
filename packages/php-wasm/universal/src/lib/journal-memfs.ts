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
export type CreateDirectoryOperation = {
	/** The type of operation being performed. */
	operation: 'CREATE_DIRECTORY';
	/** The path of the node being updated. */
	path: string;
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
	| CreateDirectoryOperation
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

	const originalMkdir = FS.mkdir;
	FS.mkdir = function (path: string, ...rest: any[]) {
		addEntry({
			operation: 'CREATE_DIRECTORY',
			path,
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

	const workingSet: Set<string> = new Set();
	function addEntry(entry: FilesystemOperation) {
		if (!entry.path.startsWith(memfsRoot) || entry.path === memfsRoot) {
			return;
		}
		// Partition the entries into groups of operations that can be
		// performed in parallel.
		const lastPartition = journal.partitions[journal.partitions.length - 1];
		const lastEntry = lastPartition[lastPartition.length - 1];

		// RENAME entries are always added to a new partition because
		// parallelizing the following two RENAME operations only works
		// if the first one is done before the second one:
		//     RENAME /path_1 /path_2
		//     RENAME /path_2 /path_3
		if (
			entry.operation === lastEntry.operation &&
			entry.operation !== 'RENAME'
		) {
			// Don't add duplicate entries to the same partition.
			// to make async processing easier later on.
			if (workingSet.has(entry.path)) {
				return;
			}
			workingSet.add(entry.path);
			lastPartition.push(entry);
			onEntry(entry);
			return;
		}

		journal.partitions.push([entry]);
		workingSet.clear();
		onEntry(entry);
	}

	const journal = {
		partitions: [
			[{ operation: 'NOOP', path: '' }],
		] as FilesystemOperation[][],
		size() {
			return journal.partitions
				.map((p) => p.length)
				.reduce((a, b) => a + b, 0);
		},
		flush(): FilesystemOperation[][] {
			// Remove the NOOP partition
			const entries = this.partitions.slice(1);
			journal.partitions = [[{ operation: 'NOOP', path: '' }]];
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
