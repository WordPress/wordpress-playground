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
import { __private__dont__use } from '@php-wasm/universal';
import { Semaphore, joinPaths } from '@php-wasm/util';
import type { WebPHP } from '@php-wasm/web';

type EmscriptenFS = any;
type EmscriptenFSStream = {
	path: string;
	node: EmscriptenFSNode;
};
type EmscriptenFSNode = {
	name: string;
	mode: number;
	node_ops: any;
};

declare global {
	interface FileSystemDirectoryHandle {
		values: () => AsyncIterable<
			FileSystemDirectoryHandle | FileSystemFileHandle
		>;
	}
}

type MemfsDeltaObserver = (delta: FSDelta) => any;
export function onMemfsDelta(php: WebPHP, callback: MemfsDeltaObserver) {
	const runningDelta = new FSDelta();
	const cleanupMemfsObservers = setupMemfsJournal(php, runningDelta);
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
		await callback(runningDelta);
		runningDelta.reset();
		return response;
	};

	return () => {
		cleanupMemfsObservers();
		php.run = originalRun;
	};
}

class FSDelta {
	updatedFiles = new Set<string>();
	removedFiles = new Set<string>();
	createdDirectories = new Set<string>();
	removedDirectories = new Set<string>();

	reset() {
		this.updatedFiles.clear();
		this.removedFiles.clear();
		this.createdDirectories.clear();
		this.removedDirectories.clear();
	}
}

export async function copyOpfsToMemfs(
	php: WebPHP,
	opfsRoot: FileSystemDirectoryHandle,
	memfsRoot: string
) {
	const PHPRuntime = php[__private__dont__use];
	const FS = PHPRuntime.FS;
	FS.mkdirTree(memfsRoot);

	/**
	 * Semaphores are used to limit the number of concurrent operations.
	 * Flooding the browser with 2000 FS operations at the same time
	 * can get quite slow.
	 */
	const semaphore = new Semaphore({
		concurrency: 40,
	});

	const ops: Array<Promise<void>> = [];
	const stack: Array<[FileSystemDirectoryHandle, string]> = [
		[opfsRoot, memfsRoot],
	];
	while (stack.length > 0) {
		const [opfsParent, memfsParentPath] = stack.pop()!;

		for await (const opfsHandle of opfsParent.values()) {
			const op = semaphore.run(async () => {
				const memfsEntryPath = joinPaths(
					memfsParentPath,
					opfsHandle.name
				);
				if (opfsHandle.kind === 'directory') {
					try {
						FS.mkdir(memfsEntryPath);
					} catch (e) {
						if ((e as any)?.errno !== 20) {
							console.error(e);
							// We ignore the error if the directory already exists,
							// and throw otherwise.
							throw e;
						}
					}
					stack.push([opfsHandle, memfsEntryPath]);
				} else if (opfsHandle.kind === 'file') {
					const file = await opfsHandle.getFile();
					const byteArray = new Uint8Array(await file.arrayBuffer());
					FS.createDataFile(
						memfsEntryPath,
						null,
						byteArray,
						true,
						true,
						true
					);
				}
				ops.splice(ops.indexOf(op), 1);
			});
			ops.push(op);
		}
		// Let the ongoing operations catch-up to the stack.
		while (stack.length === 0 && ops.length > 0) {
			await Promise.any(ops);
		}
	}
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

export async function copyMemfsToOpfs(
	php: WebPHP,
	opfsRoot: FileSystemDirectoryHandle,
	memfsRoot: string
) {
	const PHPRuntime = php[__private__dont__use];
	const FS = PHPRuntime.FS;
	// Ensure the memfs directory exists.
	FS.mkdirTree(memfsRoot);

	/**
	 * Semaphores are used to limit the number of concurrent operations.
	 * Flooding the browser with 2000 FS operations at the same time
	 * can get quite slow.
	 */
	const semaphore = new Semaphore({
		concurrency: 40,
	});
	const ops: Array<Promise<any>> = [];
	const stack: Array<[Promise<FileSystemDirectoryHandle>, string]> = [
		[Promise.resolve(opfsRoot), memfsRoot],
	];
	while (stack.length) {
		const [opfsDirPromise, memfsParent] = stack.pop()!;
		const opfsDir = await opfsDirPromise;

		for (const entryName of FS.readdir(memfsParent)) {
			if (entryName === '.' || entryName === '..') continue;

			const memfsPath = joinPaths(memfsParent, entryName);
			const lookup = FS.lookupPath(memfsPath, {
				follow: true,
			});
			const memFsNode = lookup.node;
			const isDir = FS.isDir(memFsNode.mode);

			const op = semaphore.run(async () => {
				if (isDir) {
					const handlePromise = opfsDir.getDirectoryHandle(
						entryName,
						{
							create: true,
						}
					);
					stack.push([handlePromise, memfsPath]);
				} else {
					await overwriteOpfsFile(opfsDir, entryName, FS, memfsPath);
				}
				ops.splice(ops.indexOf(op), 1);
			});
			ops.push(op);
		}

		// Let the ongoing operations catch-up to the stack.
		while (stack.length === 0 && ops.length > 0) {
			await Promise.any(ops);
		}
	}
}

function setupMemfsJournal(php: WebPHP, fsState: FSDelta) {
	const PHPRuntime = php[__private__dont__use];
	const FS = PHPRuntime.FS;

	if (FS.fsObserversBound) {
		return () => {};
	}
	FS.fsObserversBound = true;

	const MEMFS = FS.filesystems.MEMFS;

	const originalWrite = FS.write;
	FS.write = function (stream: EmscriptenFSStream) {
		fsState.updatedFiles.add(stream.path);
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
		for (const set of [fsState.updatedFiles, fsState.createdDirectories]) {
			for (const path of set) {
				if (path.startsWith(old_path)) {
					set.delete(path);
					set.add(
						joinPaths(new_path, path.substring(old_path.length))
					);
				}
			}
		}
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
		fsState.updatedFiles.add(FS.getPath(node));
		return originalTruncate(...arguments);
	};

	const originalUnlink = FS.unlink;
	FS.unlink = function (path: string) {
		fsState.removedFiles.add(path);
		return originalUnlink(...arguments);
	};

	const originalMkdir = FS.mkdir;
	FS.mkdir = function (path: string) {
		fsState.createdDirectories.add(path);
		return originalMkdir(...arguments);
	};

	const originalRmdir = FS.rmdir;
	FS.rmdir = function (path: string) {
		fsState.removedDirectories.add(path);
		return originalRmdir(...arguments);
	};

	return () => {
		FS.write = originalWrite;
		MEMFS.ops_table.dir.node.rename = originalRename;
		FS.truncate = originalTruncate;
		FS.unlink = originalUnlink;
		FS.mkdir = originalMkdir;
		FS.rmdir = originalRmdir;
	};
}

export async function syncMemfsDeltaToOpfs(
	php: WebPHP,
	opfs: FileSystemDirectoryHandle,
	memfsRoot: string,
	delta: FSDelta
) {
	const PHPRuntime = php[__private__dont__use];
	const FS = PHPRuntime.FS;

	const asyncMapPaths = async (
		paths: Iterable<string>,
		callback: (data: {
			opfsParent: FileSystemDirectoryHandle;
			name: string;
			memfsPath: string;
		}) => Promise<any>
	) => {
		return await asyncMap(paths, async (memfsPath) => {
			if (!memfsPath.startsWith(memfsRoot)) {
				return;
			}
			const opfsPath = memfsPath
				.substring(memfsRoot.length)
				.replace(/\/$/, '');
			const lastSlash = opfsPath.lastIndexOf('/');
			if (lastSlash === -1) {
				return;
			}
			const opfsParent = await resolveParent(opfs, opfsPath);
			const name = opfsPath.substring(lastSlash + 1);
			await callback({ opfsParent, name, memfsPath });
		});
	};

	// Sync deletions of files and directories
	await asyncMapPaths(
		[...delta.removedDirectories, ...delta.removedFiles]
			// We sort the directories by length descending so that we delete
			// the child directories before the parents
			.sort((a, b) => b.length - a.length),
		async ({ opfsParent, name }) => {
			try {
				await opfsParent.removeEntry(name, { recursive: true });
			} catch (e) {
				// If the directory already doesn't exist, it's fine
			}
		}
	);

	// Sync created directories
	await asyncMapPaths(
		[...delta.createdDirectories]
			// We sort the directories by length so that we create
			// the parent directories before the children.
			.sort((a, b) => a.length - b.length),
		async ({ opfsParent, name }) => {
			await opfsParent.getDirectoryHandle(name, { create: true });
		}
	);

	// Sync updated files
	await asyncMapPaths(
		delta.updatedFiles,
		async ({ opfsParent, memfsPath, name }) => {
			await overwriteOpfsFile(opfsParent, name, FS, memfsPath);
		}
	);
}

async function overwriteOpfsFile(
	opfsParent: FileSystemDirectoryHandle,
	name: string,
	FS: EmscriptenFS,
	memfsPath: string
) {
	let buffer;
	try {
		buffer = FS.readFile(memfsPath, {
			encoding: 'binary',
		});
	} catch (e) {
		// File was removed, ignore
		return;
	}

	const opfsFile = await opfsParent.getFileHandle(name, { create: true });
	const accessHandle = await opfsFile.createSyncAccessHandle();
	try {
		await accessHandle.truncate(0);
		await accessHandle.write(buffer);
	} finally {
		await accessHandle.close();
	}
}

export async function OpfsFileExists(
	opfs: FileSystemDirectoryHandle,
	path: string
) {
	try {
		await opfs.getFileHandle(path);
		return true;
	} catch (e) {
		return false;
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
