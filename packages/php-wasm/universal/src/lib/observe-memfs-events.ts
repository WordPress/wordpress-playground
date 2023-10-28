import { BasePHP, __private__dont__use } from './base-php';
import { joinPaths } from '@php-wasm/util';

export type EmscriptenFSStream = {
	path: string;
	node: EmscriptenFSNode;
};
export type EmscriptenFSNode = {
	name: string;
	mode: number;
	node_ops: any;
};

export type NodeType = 'file' | 'directory';
export type NoopEntry = {
	type: 'NOOP';
	path: '';
};
export type UpdateEntry = {
	type: 'UPDATE';
	path: string;
	nodeType: NodeType;
};

export type DeleteEntry = {
	type: 'DELETE';
	path: string;
	nodeType: NodeType;
};

export type RenameEntry = {
	type: 'RENAME';
	path: string;
	toPath: string;
	nodeType: NodeType;
};
export type FilesystemEntry =
	| NoopEntry
	| UpdateEntry
	| DeleteEntry
	| RenameEntry;

export function observeMemfsEvents(php: BasePHP) {
	const FS = php[__private__dont__use].FS;
	const MEMFS = FS.filesystems.MEMFS;

	// Bind the journal to the filesystem
	const originalWrite = FS.write;
	FS.write = function (stream: EmscriptenFSStream, ...rest: any[]) {
		php.dispatchEvent('fs', {
			type: 'UPDATE',
			path: stream.path,
			nodeType: 'file',
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
		php.dispatchEvent('fs', {
			type: 'RENAME',
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
		php.dispatchEvent('fs', {
			type: 'UPDATE',
			path: FS.getPath(node),
			nodeType: 'file',
		});
		return originalTruncate(path, ...rest);
	};

	const originalUnlink = FS.unlink;
	FS.unlink = function (path: string, ...rest: any[]) {
		php.dispatchEvent('fs', {
			type: 'DELETE',
			path,
			nodeType: 'file',
		});
		return originalUnlink(path, ...rest);
	};

	const originalMkdir = FS.mkdir;
	FS.mkdir = function (path: string, ...rest: any[]) {
		php.dispatchEvent('fs', {
			type: 'UPDATE',
			path,
			nodeType: 'directory',
		});
		return originalMkdir(path, ...rest);
	};

	const originalRmdir = FS.rmdir;
	FS.rmdir = function (path: string, ...rest: any[]) {
		php.dispatchEvent('fs', {
			type: 'DELETE',
			path,
			nodeType: 'directory',
		});
		return originalRmdir(path, ...rest);
	};

	return function unbind() {
		FS.write = originalWrite;
		MEMFS.ops_table.dir.node.rename = originalRename;
		FS.truncate = originalTruncate;
		FS.unlink = originalUnlink;
		FS.mkdir = originalMkdir;
		FS.rmdir = originalRmdir;
		FS.hasJournal = false;
	};
}
