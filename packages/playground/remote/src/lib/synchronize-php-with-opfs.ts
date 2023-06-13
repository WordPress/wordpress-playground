/* eslint-disable prefer-rest-params */
import { __private__dont__use } from '@php-wasm/universal';
import { Semaphore } from '@php-wasm/util';
import { WebPHP } from '@php-wasm/web';

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
type FileWriterResult = {
	bytesWritten: number;
};
type FileWriter = {
	write: (data: Blob) => void;
	truncate: (bytes: Number) => void;
	close: () => void;
	onwriteend: (callback: (result: FileWriterResult) => void) => void;
};

declare global {
	interface FileSystemFileEntry {
		createWriter: (
			callback: (writer: FileWriter) => void,
			errorCallback: ErrorCallback
		) => void;
		remove: (
			successCallback: SuccessCallback,
			errorCallback: ErrorCallback
		) => void;
	}
	interface FileSystemDirectoryEntry {
		removeRecursively: (
			successCallback: SuccessCallback,
			errorCallback: ErrorCallback
		) => void;
		createReader: () => FileSystemDirectoryReader;
	}
}

type SuccessCallback = (v?: any) => void;
type ErrorCallback = (e: any) => void;

type SyncPathsTuple = {
	memfsPath: string;
	opfsPath: string;
};

type OPFSSynchronizerOptions = {
	FS: any;
	joinPaths: (...paths: string[]) => string;
	opfs: FileSystem;
	memfsPath: string;
	opfsPath: string;
	hasFilesInOpfs: boolean;
};

export async function synchronizePHPWithOPFS(
	php: WebPHP,
	options: Omit<OPFSSynchronizerOptions, 'FS' | 'joinPaths'>
) {
	const PHPRuntime = php[__private__dont__use];

	const FS = PHPRuntime.FS;
	FS.joinPaths = PHPRuntime.PATH.join;

	// Ensure the memfs directory exists.
	try {
		FS.mkdir(options.memfsPath);
	} catch (e) {
		if ((e as any)?.errno !== 20) {
			// We ignore the error if the directory already exists,
			// and throw otherwise.
			throw e;
		}
	}

	const fsState = new FSState();
	observeMEMFSChanges(FS, fsState);

	if (options.hasFilesInOpfs) {
		await populateMemfs(
			options.opfs,
			PHPRuntime.FS,
			options.memfsPath,
			options.opfsPath,
			fsState
		);
	} else {
		await exportEntireMemfsToOpfs(
			options.opfs,
			PHPRuntime.FS,
			options.memfsPath,
			options.opfsPath
		);
	}

	const toOpfsPath = (memfsPath: string) =>
		FS.joinPaths(
			options.opfsPath,
			memfsPath.substring(options.memfsPath.length)
		);

	/**
	 * Do not do this in external code. This is a temporary solution
	 * to allow some time for a few more use-cases to emerge before
	 * proposing a new public API like php.onRun().
	 */
	const originalRun = php.run;
	php.run = async function (...args) {
		const response = await originalRun.apply(this, args);
		await exportMemfsChangesToOpfs(
			options.opfs,
			fsState,
			PHPRuntime.FS,
			toOpfsPath
		);
		return response;
	};
}

const semaphore = new Semaphore({
	concurrency: 40,
});

class FSState {
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

async function populateMemfs(
	opfs: FileSystem,
	FS: EmscriptenFS,
	memfsPath: string,
	opfsPath: string,
	fsState: FSState
) {
	await recursivePopulateMemfs(opfs, FS, opfsPath, memfsPath);
	fsState.reset();
}

async function recursivePopulateMemfs(
	opfs: FileSystem,
	FS: EmscriptenFS,
	opfsSrc: string,
	memfsDest: string
) {
	const dir = await getOpfsDirectory(opfs, opfsSrc);
	const reader = dir.createReader();
	while (true) {
		const entries = await new Promise<FileSystemEntry[]>(
			(resolve, reject) => {
				reader.readEntries(resolve, reject);
			}
		);
		if (!entries.length) {
			break;
		}

		await Promise.all(
			entries.map(async (entry) => {
				const memfsPath = FS.joinPaths(memfsDest, entry.name);

				if (entry.isDirectory) {
					try {
						FS.mkdir(memfsPath);
					} catch (e) {
						// Directory already exists, ignore.
						// There's also a chance it couldn't be created
						// @TODO: Handle this case
						console.error(e);
						throw e;
					}
					await recursivePopulateMemfs(
						opfs,
						FS,
						entry.fullPath,
						memfsPath
					);
				} else {
					const release = await semaphore.acquire();
					try {
						const blob = await new Promise<File>((resolve) =>
							(entry as FileSystemFileEntry).file(resolve)
						);
						const reader = new FileReader();
						const contents = await new Promise<ArrayBuffer>(
							(resolve) => {
								reader.onloadend = () =>
									resolve(reader.result as ArrayBuffer);
								reader.readAsArrayBuffer(blob);
							}
						);
						const byteArray = new Uint8Array(contents);
						FS.createDataFile(
							memfsPath,
							null,
							byteArray,
							true,
							true,
							true
						);
					} finally {
						release();
					}
				}
			})
		);
	}
}

async function exportEntireMemfsToOpfs(
	opfs: FileSystem,
	FS: EmscriptenFS,
	memfsPath: string,
	opfsPath: string
) {
	await createOpfsDirectory(opfs, opfsPath);
	await recursiveExportEntireMemfsToOpfs(opfs, FS, memfsPath, opfsPath);
}

async function recursiveExportEntireMemfsToOpfs(
	opfs: FileSystem,
	FS: EmscriptenFS,
	memfsSrc: string,
	opfsDest: string
) {
	await Promise.all(
		FS.readdir(memfsSrc).map(async (name: string) => {
			if (name === '.' || name === '..') return;
			const memfsPath = FS.joinPaths(memfsSrc, name);
			const lookup = FS.lookupPath(memfsPath, {
				follow: true,
			});
			const memFsNode = lookup.node;
			const isDir = FS.isDir(memFsNode.mode);

			const opfsPath = FS.joinPaths(opfsDest, name);
			if (isDir) {
				await createOpfsDirectory(opfs, opfsPath);
				await recursiveExportEntireMemfsToOpfs(
					opfs,
					FS,
					memfsPath,
					opfsPath
				);
			} else {
				await overwriteOpfsFile(opfs, FS, { memfsPath, opfsPath });
			}
		})
	);
}

function observeMEMFSChanges(FS: EmscriptenFS, fsState: FSState) {
	if (FS.fsObserversBound) {
		return;
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
		const new_path = FS.joinPaths(FS.getPath(new_dir), new_name);
		for (const set of [fsState.updatedFiles, fsState.createdDirectories]) {
			for (const path of set) {
				if (path.startsWith(old_path)) {
					set.delete(path);
					set.add(
						FS.joinPaths(new_path, path.substring(old_path.length))
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
}

async function exportMemfsChangesToOpfs(
	opfs: FileSystem,
	delta: FSState,
	FS: EmscriptenFS,
	toOpfsPath: (path: string) => string
) {
	await Promise.all([
		...[...delta.removedFiles].map((memfsPath) =>
			removeOpfsFile(opfs, toOpfsPath(memfsPath))
		),
		...[...delta.removedDirectories].map((memfsPath) =>
			removeOpfsDirectory(opfs, toOpfsPath(memfsPath))
		),
	]);
	await Promise.all(
		[...delta.createdDirectories]
			.map(toOpfsPath)
			// We sort the directories by length so that we create
			// the parent directories before the children.
			.sort((a, b) => b.length - a.length)
			.map((opfsPath) => createOpfsDirectory(opfs, opfsPath))
	);

	await Promise.all(
		[...delta.updatedFiles].map((memfsPath) =>
			overwriteOpfsFile(opfs, FS, {
				memfsPath,
				opfsPath: toOpfsPath(memfsPath),
			})
		)
	);

	delta.reset();
}

async function overwriteOpfsFile(
	opfs: FileSystem,
	FS: EmscriptenFS,
	{ memfsPath, opfsPath }: SyncPathsTuple
) {
	const release = await semaphore.acquire();
	try {
		let buffer;
		try {
			buffer = FS.readFile(memfsPath, {
				encoding: 'binary',
			});
		} catch (e) {
			// File was removed, ignore
			return;
		}

		const opfsFile = await getOpfsFile(opfs, opfsPath, {
			create: true,
		});
		const writer = await new Promise<FileWriter>((resolve, reject) =>
			opfsFile.createWriter(resolve, reject)
		);
		writer.truncate(0);
		await new Promise((resolve) => {
			writer.onwriteend = resolve;
		});

		writer.write(new Blob([buffer], { type: 'application/octet-stream' }));
		await new Promise((resolve) => {
			writer.onwriteend = resolve;
		});
	} finally {
		release();
	}
}

async function createOpfsDirectory(opfs: FileSystem, opfsPath: string) {
	const release = await semaphore.acquire();
	try {
		await getOpfsDirectory(opfs, opfsPath, {
			create: true,
		});
	} finally {
		release();
	}
}

async function removeOpfsDirectory(opfs: FileSystem, opfsPath: string) {
	const release = await semaphore.acquire();
	try {
		const entry = await getOpfsDirectory(opfs, opfsPath);
		await new Promise((resolve, reject) =>
			entry.removeRecursively(resolve, reject)
		);
	} catch (e) {
		// Directory doesn't exist or was already removed, that's fine.
		return;
	} finally {
		release();
	}
}

async function removeOpfsFile(opfs: FileSystem, opfsPath: string) {
	const release = await semaphore.acquire();
	try {
		const entry = await getOpfsFile(opfs, opfsPath);
		await new Promise((resolve, reject) => entry.remove(resolve, reject));
	} catch (e) {
		// File doesn't exist or was already removed, that's fine.
		return;
	} finally {
		release();
	}
}

export async function OpfsFileExists(opfs: FileSystem, path: string) {
	try {
		await getOpfsFile(opfs, path);
		return true;
	} catch (e) {
		return false;
	}
}

async function getOpfsFile(
	opfs: FileSystem,
	path: string,
	opts: FileSystemGetFileOptions = {}
) {
	return await new Promise<FileSystemFileEntry>((resolve, reject) => {
		opfs.root.getFile(
			path,
			opts,
			(value) => resolve(value as FileSystemFileEntry),
			reject
		);
	});
}

export async function getOpfsDirectory(
	opfs: FileSystem,
	path: string,
	opts: FileSystemGetFileOptions = {}
) {
	return await new Promise<FileSystemDirectoryEntry>((resolve, reject) => {
		opfs.root.getDirectory(
			path,
			opts,
			(value) => resolve(value as FileSystemDirectoryEntry),
			reject
		);
	});
}
