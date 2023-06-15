/**
 * Uses the FileSystem access API to synchronize MEMFS changes in a compliant
 * filesystem such as OPFS or local filesystem and restore them on page refresh:
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
 *
 * Many synchronous functions are await-ed here because some browsers did not
 * catch up yet with the latest spec and still return promises.
 */

/* eslint-disable prefer-rest-params */
import type { WebPHP } from '@php-wasm/web';
import type {
	EmscriptenFS,
	EmscriptenFSNode,
	EmscriptenFSStream,
} from './types';
import { __private__dont__use } from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';
import { copyMemfsToOpfs, overwriteOpfsFile } from './opfs-memfs';

export function journalMemfsToOpfs(
	php: WebPHP,
	opfsRoot: FileSystemDirectoryHandle,
	memfsRoot: string
) {
	const journal = FilesystemJournal.createFor(php, opfsRoot, memfsRoot);
	return () => {
		journal.unbind();
	};
}

type NodeType = 'file' | 'directory';
type NoopEntry = {
	type: 'NOOP';
	path: '';
};
type UpdateEntry = {
	type: 'UPDATE';
	path: string;
	nodeType: NodeType;
};

type DeleteEntry = {
	type: 'DELETE';
	path: string;
	nodeType: NodeType;
};

type RenameEntry = {
	type: 'RENAME';
	path: string;
	toPath: string;
	nodeType: NodeType;
};

type JournalEntry = NoopEntry | UpdateEntry | DeleteEntry | RenameEntry;

class FilesystemJournal {
	private FS: EmscriptenFS;
	private workingSet: Set<string> = new Set();
	private entries: JournalEntry[][] = [];
	unbind: () => void = () => {};

	public static createFor(
		php: WebPHP,
		opfsRoot: FileSystemDirectoryHandle,
		memfsRoot: string
	) {
		const FS = php[__private__dont__use].FS;
		if (FS.hasJournal) {
			throw new Error('Journal already bound');
		}
		FS.hasJournal = true;

		const MEMFS = FS.filesystems.MEMFS;
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const journal = new FilesystemJournal(php);

		const originalWrite = FS.write;
		FS.write = function (stream: EmscriptenFSStream) {
			journal.addEntry({
				type: 'UPDATE',
				path: stream.path,
				nodeType: 'file',
			});
			return originalWrite(...arguments);
		};

		const originalRename = MEMFS.ops_table.dir.node.rename;
		MEMFS.ops_table.dir.node.rename = function (
			old_node: EmscriptenFSNode,
			new_dir: EmscriptenFSNode,
			new_name: string
		) {
			const old_path = FS.getPath(old_node);
			const new_path = joinPaths(FS.getPath(new_dir), new_name);
			journal.addEntry({
				type: 'RENAME',
				nodeType: FS.isDir(old_node.mode) ? 'directory' : 'file',
				path: old_path,
				toPath: new_path,
			});
			return originalRename(...arguments);
		};

		const originalTruncate = FS.truncate;
		FS.truncate = function (path: string) {
			let node;
			if (typeof path == 'string') {
				const lookup = FS.lookupPath(path, {
					follow: true,
				});
				node = lookup.node;
			} else {
				node = path;
			}
			journal.addEntry({
				type: 'UPDATE',
				path: FS.getPath(node),
				nodeType: 'file',
			});
			return originalTruncate(...arguments);
		};

		const originalUnlink = FS.unlink;
		FS.unlink = function (path: string) {
			journal.addEntry({
				type: 'DELETE',
				path,
				nodeType: 'file',
			});
			return originalUnlink(...arguments);
		};

		const originalMkdir = FS.mkdir;
		FS.mkdir = function (path: string) {
			journal.addEntry({
				type: 'UPDATE',
				path,
				nodeType: 'directory',
			});
			return originalMkdir(...arguments);
		};

		const originalRmdir = FS.rmdir;
		FS.rmdir = function (path: string) {
			journal.addEntry({
				type: 'DELETE',
				path,
				nodeType: 'directory',
			});
			return originalRmdir(...arguments);
		};

		/**
		 * Calls the observer with the current delta each time PHP is ran.
		 *
		 * Do not do this in external code. This is a private code path that
		 * will be maintained alongside Playground code and likely removed
		 * in the future. It is not part of the public API. The goal is to
		 * allow some time for a few more use-cases to emerge before
		 * proposing a new public API like php.addEventListener( 'run' ).
		 */
		const originalRun = php.run;
		php.run = async function (...args) {
			const response = await originalRun.apply(this, args);
			await journal.flush(opfsRoot, memfsRoot);
			return response;
		};

		journal.unbind = () => {
			php.run = originalRun;

			FS.write = originalWrite;
			MEMFS.ops_table.dir.node.rename = originalRename;
			FS.truncate = originalTruncate;
			FS.unlink = originalUnlink;
			FS.mkdir = originalMkdir;
			FS.rmdir = originalRmdir;
		};
		return journal;
	}

	private constructor(private php: WebPHP) {
		this.FS = this.php[__private__dont__use].FS;
		this.reset();
	}

	addEntry(entry: JournalEntry) {
		const lastPartition = this.entries[this.entries.length - 1];
		const lastEntry = lastPartition[lastPartition.length - 1];

		// Partition by entry type for easier processing later.
		// RENAME entries are always added to a new partition because
		// they can collide with each other.
		if (entry.type === lastEntry.type && entry.type !== 'RENAME') {
			// Don't add duplicate entries to the same partition.
			// to make async processing easier later on.
			if (this.workingSet.has(entry.path)) {
				return;
			}
			this.workingSet.add(entry.path);
			lastPartition.push(entry);
		} else {
			this.entries.push([entry]);
			this.workingSet.clear();
		}
	}

	async flush(opfs: FileSystemDirectoryHandle, memfsRoot: string) {
		// Return everything except for the NOOP partition
		const entries = this.entries.slice(1);
		this.reset();

		const normalizeMemfsPath = (path: string) =>
			path.replace(/\/$/, '').replace(/\/\/+/g, '/');
		const toOpfsPath = (path: string) =>
			normalizeMemfsPath(path.substring(memfsRoot.length));
		const getFilename = (path: string) =>
			path.substring(path.lastIndexOf('/') + 1);

		memfsRoot = normalizeMemfsPath(memfsRoot);

		for (const partition of entries) {
			const type = partition[0].type;
			await asyncMap(partition, async (entry) => {
				if (
					!entry.path.startsWith(memfsRoot) ||
					normalizeMemfsPath(entry.path) === memfsRoot
				) {
					return;
				}
				const opfsPath = toOpfsPath(entry.path);
				const opfsParent = await resolveParent(opfs, opfsPath);
				const name = getFilename(opfsPath);
				if (!name) {
					return;
				}

				try {
					if (type === 'DELETE') {
						try {
							await opfsParent.removeEntry(name, {
								recursive: true,
							});
						} catch (e) {
							// If the directory already doesn't exist, it's fine
						}
					} else if (entry.type === 'UPDATE') {
						if (entry.nodeType === 'directory') {
							await opfsParent.getDirectoryHandle(name, {
								create: true,
							});
						} else {
							await overwriteOpfsFile(
								opfsParent,
								name,
								this.FS,
								entry.path
							);
						}
					} else if (
						entry.type === 'RENAME' &&
						entry.toPath.startsWith(memfsRoot)
					) {
						const opfsTargetPath = toOpfsPath(entry.toPath);
						const opfsTargetParent = await resolveParent(
							opfs,
							opfsTargetPath
						);
						const targetName = getFilename(opfsTargetPath);

						if (entry.nodeType === 'directory') {
							const opfsDir =
								await opfsTargetParent.getDirectoryHandle(
									name,
									{
										create: true,
									}
								);
							// in OPFS, move() doesn't work for directories :-(
							// We have to copy the directory recursively instead.
							await copyMemfsToOpfs(
								this.php,
								opfsDir,
								entry.toPath
							);
							// Then delete the old directory
							await opfsParent.removeEntry(name, {
								recursive: true,
							});
						} else {
							const file = await opfsParent.getFileHandle(name);
							file.move(opfsTargetParent, targetName);
						}
					}
				} catch (e) {
					console.log({ entry, name });
					console.error(e);
					throw e;
				}
			});
		}
	}

	private reset() {
		// Always have at least one entry to avoid having to check for
		// empty partitions in the code.
		this.entries = [[{ type: 'NOOP', path: '' }]];
	}
}

async function resolveParent(
	opfs: FileSystemDirectoryHandle,
	relativePath: string
): Promise<FileSystemDirectoryHandle> {
	const normalizedPath = relativePath
		.replace(/^\/+|\/+$/g, '')
		.replace(/\/+/, '/');
	if (!normalizedPath) {
		return opfs;
	}
	const segments = normalizedPath.split('/');
	let handle: FileSystemDirectoryHandle | FileSystemFileHandle = opfs;
	for (let i = 0; i < segments.length - 1; i++) {
		const segment = segments[i];
		handle = await handle.getDirectoryHandle(segment, { create: true });
	}
	return handle as any;
}

async function asyncMap<T, U>(
	iter: Iterable<T>,
	asyncFunc: (value: T) => Promise<U>
): Promise<U[]> {
	const promises: Promise<U>[] = [];
	for (const value of iter) {
		promises.push(asyncFunc(value));
	}
	return await Promise.all(promises);
}
