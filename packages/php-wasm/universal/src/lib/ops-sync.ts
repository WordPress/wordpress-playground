/* eslint-disable prefer-rest-params */
import { Semaphore } from '@php-wasm/util';

const TYPE_DIR = 'directory';
const TYPE_FILE = 'file';

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
};

export class OPFSSynchronizer {
	private options: OPFSSynchronizerOptions;
	private semaphore = new Semaphore({
		concurrency: 40,
	});
	private updatedFiles = new Set<string>();
	private removedFiles = new Set<string>();
	private createdDirectories = new Set<string>();
	private removedDirectories = new Set<string>();
	constructor(options: OPFSSynchronizerOptions) {
		this.options = options;
		try {
			options.FS.mkdir(options.memfsPath);
		} catch (e) {
			if ((e as any)?.errno !== 20) {
				// We ignore the error if the directory already exists,
				// and throw otherwise.
				throw e;
			}
		}
	}

	async copyChangesToOPFS() {
		console.time('copyChangesToOPFS');
		const asPaths = (set: Set<string>): SyncPathsTuple[] =>
			Array.from(set)
				.filter((path) => path.startsWith(this.options.memfsPath))
				.map((path) => ({
					memfsPath: path,
					opfsPath: this.options.joinPaths(
						this.options.opfsPath,
						path.substring(this.options.memfsPath.length)
					),
				}));
		await Promise.all([
			...asPaths(this.removedFiles).map((path) =>
				this.removeOpfsFile(path)
			),
			...asPaths(this.removedDirectories).map((path) =>
				this.removeOpfsDirectory(path)
			),
		]);
		await Promise.all(
			asPaths(this.createdDirectories).map(({ opfsPath }) =>
				this.createOpfsDirectory(opfsPath)
			)
		);

		await Promise.all(
			asPaths(this.updatedFiles).map((path) =>
				this.overwriteOpfsFile(path)
			)
		);

		this.removedFiles.clear();
		this.removedDirectories.clear();
		this.createdDirectories.clear();
		this.updatedFiles.clear();
		console.timeEnd('copyChangesToOPFS');
	}

	async toMEMFS() {
		console.time('toMEMFS');
		await this.internalToMEMFS(
			this.options.opfsPath,
			this.options.memfsPath
		);
		console.timeEnd('toMEMFS');
	}

	private async internalToMEMFS(src: string, dest: string) {
		const dir = await this.getOpfsDirectory(src);
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
					const memfsPath = this.options.joinPaths(dest, entry.name);

					if (entry.isDirectory) {
						try {
							this.options.FS.mkdir(memfsPath);
						} catch (e) {
							// Directory already exists, ignore.
							// There's also a chance it couldn't be created
							// @TODO: Handle this case
							console.error(e);
							throw e;
						}
						await this.internalToMEMFS(entry.fullPath, memfsPath);
					} else {
						const release = await this.semaphore.acquire();
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
							this.options.FS.createDataFile(
								memfsPath,
								null,
								byteArray,
								true,
								true,
								true
							);
							// } catch (e) {
							// 	console.log(entry, memfsPath);
							// 	console.error(e);
						} finally {
							release();
						}
					}
				})
			);
		}
	}

	async resetOpfs() {
		const entry = await this.getOpfsDirectory(this.options.opfsPath, {
			create: true,
		});
		await new Promise((resolve, reject) =>
			entry.removeRecursively(resolve, reject)
		);
		await this.getOpfsDirectory(this.options.opfsPath, {
			create: true,
		});
	}

	private async overwriteOpfsFile({ memfsPath, opfsPath }: SyncPathsTuple) {
		const release = await this.semaphore.acquire();
		try {
			let buffer;
			try {
				buffer = this.options.FS.readFile(memfsPath, {
					encoding: 'binary',
				});
			} catch (e) {
				// File was removed, ignore
				return;
			}

			const opfsFile = await this.getOpfsFile(opfsPath, {
				create: true,
			});
			const writer = await new Promise<FileWriter>((resolve, reject) =>
				opfsFile.createWriter(resolve, reject)
			);
			writer.truncate(0);
			await new Promise((resolve) => {
				writer.onwriteend = resolve;
			});

			writer.write(
				new Blob([buffer], { type: 'application/octet-stream' })
			);
			await new Promise((resolve) => {
				writer.onwriteend = resolve;
			});
		} finally {
			release();
		}
	}

	private async createOpfsDirectory(opfsPath: string) {
		const release = await this.semaphore.acquire();
		try {
			await this.getOpfsEntry(opfsPath, TYPE_DIR, { create: true });
		} catch (e) {
			// Can't create directory – this is probably due to
			// a rename() call on a higher-up hierarchy folder
			// earlier on. Let's pay attention to this later.
			console.log('Failed to create directory', opfsPath);
			console.error(e);
		} finally {
			release();
		}
	}

	private async removeOpfsDirectory({ opfsPath }: SyncPathsTuple) {
		const release = await this.semaphore.acquire();
		try {
			const entry = await this.getOpfsDirectory(opfsPath);
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

	private async removeOpfsFile({ opfsPath }: SyncPathsTuple) {
		const release = await this.semaphore.acquire();
		try {
			const entry = await this.getOpfsFile(opfsPath);
			await new Promise((resolve, reject) =>
				entry.remove(resolve, reject)
			);
		} catch (e) {
			// File doesn't exist or was already removed, that's fine.
			return;
		} finally {
			release();
		}
	}

	private async getOpfsEntry(
		path: string,
		type: string,
		opts: FileSystemGetFileOptions | FileSystemGetDirectoryOptions = {}
	): Promise<FileSystemFileEntry | FileSystemDirectoryEntry> {
		if (type === TYPE_DIR) {
			return await this.getOpfsDirectory(path, opts);
		} else if (type === TYPE_FILE) {
			return await this.getOpfsFile(path, opts);
		} else {
			throw new Error(`Unknown type: ${type}`);
		}
	}

	private async getOpfsDirectory(
		path: string,
		opts: FileSystemGetDirectoryOptions = {}
	) {
		return await new Promise<FileSystemDirectoryEntry>(
			(resolve, reject) => {
				this.options.opfs.root.getDirectory(
					path,
					opts,
					(value) => resolve(value as FileSystemDirectoryEntry),
					reject
				);
			}
		);
	}

	private async getOpfsFile(
		path: string,
		opts: FileSystemGetFileOptions = {}
	) {
		return await getOpfsFile(this.options.opfs, path, opts);
	}

	observeMEMFSChanges() {
		if (this.options.FS.fsObserversBound) {
			return;
		}
		this.options.FS.fsObserversBound = true;

		const FS = this.options.FS;
		const MEMFS = FS.filesystems.MEMFS;
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const synchronizer = this;

		const originalWrite = FS.write;
		FS.write = function (stream: EmscriptenFSStream) {
			synchronizer.updatedFiles.add(stream.path);
			return originalWrite(...arguments);
		};

		const originalRename = MEMFS.ops_table.dir.node.rename;
		MEMFS.ops_table.dir.node.rename = function (
			old_node: EmscriptenFSNode,
			new_dir: EmscriptenFSNode,
			new_name: string
		) {
			const old_path = FS.getPath(old_node);
			const new_path = this.options.joinPaths(
				FS.getPath(new_dir),
				new_name
			);
			for (const set of [
				synchronizer.updatedFiles,
				synchronizer.createdDirectories,
			]) {
				for (const path of set) {
					if (path.startsWith(old_path)) {
						set.delete(path);
						set.add(
							this.options.joinPaths(
								new_path,
								path.substring(old_path.length)
							)
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
			synchronizer.updatedFiles.add(FS.getPath(node));
			return originalTruncate(...arguments);
		};

		const originalUnlink = FS.unlink;
		FS.unlink = function (path: string) {
			synchronizer.removedFiles.add(path);
			return originalUnlink(...arguments);
		};

		const originalMkdir = FS.mkdir;
		FS.mkdir = function (path: string) {
			synchronizer.createdDirectories.add(path);
			return originalMkdir(...arguments);
		};

		const originalRmdir = FS.rmdir;
		FS.rmdir = function (path: string) {
			synchronizer.removedDirectories.add(path);
			return originalRmdir(...arguments);
		};
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

export async function getOpfsFile(
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
