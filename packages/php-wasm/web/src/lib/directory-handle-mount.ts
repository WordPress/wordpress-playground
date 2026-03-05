import type { Emscripten, MountHandler, PHP } from '@php-wasm/universal';
import { FSHelpers, __private__dont__use } from '@php-wasm/universal';
import { Semaphore, basename, joinPaths } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';
import type { FilesystemOperation } from '@php-wasm/fs-journal';
import { normalizeFilesystemOperations } from '@php-wasm/fs-journal';
import { journalFSEvents } from '@php-wasm/fs-journal';
import type { MountDevice } from '@wp-playground/storage';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type * as pleaseLoadTypes from 'wicg-file-system-access';

declare global {
	interface FileSystemFileHandle {
		move(target: FileSystemDirectoryHandle): Promise<void>;
		move(name: string): Promise<void>;
		move(target: FileSystemDirectoryHandle, name: string): Promise<void>;
		createWritable(): Promise<FileSystemWritableFileStream>;
	}
	interface FileSystemWritableFileStream {
		write(
			buffer: BufferSource,
			options?: FileSystemReadWriteOptions
		): Promise<number>;
		close(): Promise<void>;
		seek(offset: number): Promise<void>;
		truncate(newSize: number): Promise<void>;
	}
}

/** @deprecated Import MountDevice from '@wp-playground/storage' instead. */
export type { MountDevice };

export interface MountOptions {
	initialSync: {
		direction?: 'opfs-to-memfs' | 'memfs-to-opfs';
		onProgress?: SyncProgressCallback;
	};
}
export type SyncProgress = {
	/** The number of files that have been synced. */
	files: number;
	/** The number of all files that need to be synced. */
	total: number;
};
export type SyncProgressCallback = (progress: SyncProgress) => void;

export function createDirectoryHandleMountHandler(
	handle: FileSystemDirectoryHandle,
	options: MountOptions = { initialSync: {} }
): MountHandler {
	options = {
		...options,
		initialSync: {
			...options.initialSync,
			direction: options.initialSync.direction ?? 'opfs-to-memfs',
		},
	};

	return async function (php, FS, vfsMountPoint) {
		if (options.initialSync.direction === 'opfs-to-memfs') {
			if (FSHelpers.fileExists(FS, vfsMountPoint)) {
				FSHelpers.rmdir(FS, vfsMountPoint);
			}
			FSHelpers.mkdir(FS, vfsMountPoint);
			await copyOpfsToMemfs(FS, handle, vfsMountPoint);
		} else {
			await copyMemfsToOpfs(
				FS,
				handle,
				vfsMountPoint,
				options.initialSync.onProgress
			);
		}
		const unbindJournal = journalFSEventsToOpfs(php, handle, vfsMountPoint);
		return unbindJournal;
	};
}

async function copyOpfsToMemfs(
	FS: Emscripten.RootFS,
	opfsRoot: FileSystemDirectoryHandle,
	memfsRoot: string
) {
	FSHelpers.mkdir(FS, memfsRoot);

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
							logger.error(e);
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
						memfsParentPath,
						opfsHandle.name,
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

export async function copyMemfsToOpfs(
	FS: Emscripten.RootFS,
	opfsRoot: FileSystemDirectoryHandle,
	memfsRoot: string,
	onProgress?: SyncProgressCallback
) {
	// Ensure the memfs directory exists.
	FS.mkdirTree(memfsRoot);

	// Create all MEMFS directories in OPFS but don't create
	// files yet. This is quite fast.
	const filesToCreate: Array<[FileSystemDirectoryHandle, string, string]> =
		[];
	async function mirrorMemfsDirectoryinOpfs(
		memfsParent: string,
		opfsDir: FileSystemDirectoryHandle
	) {
		await Promise.all(
			FS.readdir(memfsParent)
				.filter(
					(entryName: string) =>
						entryName !== '.' && entryName !== '..'
				)
				.map(async (entryName: string) => {
					const memfsPath = joinPaths(memfsParent, entryName);
					if (!isMemfsDir(FS, memfsPath)) {
						filesToCreate.push([opfsDir, memfsPath, entryName]);
						return;
					}

					const handle = await opfsDir.getDirectoryHandle(entryName, {
						create: true,
					});
					return await mirrorMemfsDirectoryinOpfs(memfsPath, handle);
				})
		);
	}
	await mirrorMemfsDirectoryinOpfs(memfsRoot, opfsRoot);

	// Now let's create all the required files in OPFS. This can be quite slow
	// so we report progress. Throttle the progress callback to avoid flooding
	// the main thread with excessive updates.
	let numFilesCompleted = 0;
	const throttledProgressCallback = onProgress && throttle(onProgress, 100);

	// Limit max concurrent writes because Safari may otherwise encounter
	// an error like "UnknownError: Invalid platform file handle" after opening
	// a sufficient number of FileSyncAccessHandles (near 128).
	// 2024-09-21: This limit was chosen based on perceived performance while
	// testing with Safari, Chrome, and Firefox. It felt like a sweet spot.
	// Writing one-at-a-time with no concurrency had similar performance
	// but felt slightly slower. We can revisit and take better measurements
	// if needed.
	const maxConcurrentWrites = 100;
	const concurrentWrites = new Set();

	try {
		for (const [opfsDir, memfsPath, entryName] of filesToCreate) {
			const promise = overwriteOpfsFile(
				opfsDir,
				entryName,
				FS,
				memfsPath
			).then(() => {
				numFilesCompleted++;
				concurrentWrites.delete(promise);

				throttledProgressCallback?.({
					files: numFilesCompleted,
					total: filesToCreate.length,
				});
			});
			concurrentWrites.add(promise);

			if (concurrentWrites.size >= maxConcurrentWrites) {
				await Promise.race(concurrentWrites);
				throttledProgressCallback?.({
					files: numFilesCompleted,
					total: filesToCreate.length,
				});
			}
		}
	} finally {
		// Make sure all FS-related activity has completed one way or another
		// before returning. Otherwise, an error followed by a retry might lead
		// to a conflict with writes from the earlier attempt.
		await Promise.allSettled(concurrentWrites);
	}
}

function isMemfsDir(FS: Emscripten.RootFS, path: string) {
	return FS.isDir(FS.lookupPath(path, { follow: true }).node.mode);
}

async function overwriteOpfsFile(
	opfsParent: FileSystemDirectoryHandle,
	name: string,
	FS: Emscripten.RootFS,
	memfsPath: string
) {
	let buffer;
	try {
		buffer = FS.readFile(memfsPath, {
			encoding: 'binary',
		});
	} catch {
		// File was removed, ignore
		return;
	}

	const opfsFile = await opfsParent.getFileHandle(name, { create: true });
	const writer =
		opfsFile.createWritable !== undefined
			? // Google Chrome, Firefox, probably more browsers
				await opfsFile.createWritable()
			: // Safari
				await opfsFile.createSyncAccessHandle();
	try {
		await writer.truncate(0);
		await writer.write(buffer);
	} finally {
		await writer.close();
	}
}

export function journalFSEventsToOpfs(
	php: PHP,
	opfsRoot: FileSystemDirectoryHandle,
	memfsRoot: string
) {
	const journal: FilesystemOperation[] = [];
	const unbindJournal = journalFSEvents(php, memfsRoot, (entry) => {
		journal.push(entry);
	});
	const rewriter = new OpfsRewriter(php, opfsRoot, memfsRoot);

	async function flushJournal() {
		if (journal.length === 0) {
			return;
		}

		const release = await php.semaphore.acquire();

		// Concurrency safety note
		// As I understand it, journal is specific to a PHP instance,
		// so it's not possible to have concurrency push of entries to journal
		// But this can change in future so it doesn't hurt to read from journal
		// in a concurrent safe way, which is what we are doing here.

		// We first copy it to a new array
		const journalEntries = [...journal];
		// and then only delete however many entries we were able to grab
		// since with concurrent writes there could have been more insertions
		journal.splice(0, journalEntries.length);

		const compressedJournal = normalizeFilesystemOperations(journalEntries);
		try {
			// @TODO This is way too slow in practice, we need to batch the
			// changes into groups of parallelizable operations.
			for (const entry of compressedJournal) {
				await rewriter.processEntry(entry);
			}
		} finally {
			release();
		}
	}
	php.addEventListener('request.end', flushJournal);
	php.addEventListener('filesystem.write', flushJournal);
	return function () {
		unbindJournal();
		php.removeEventListener('request.end', flushJournal);
		php.removeEventListener('filesystem.write', flushJournal);
	};
}

type JournalEntry = FilesystemOperation;

class OpfsRewriter {
	private memfsRoot: string;
	private php: PHP;
	private opfs: FileSystemDirectoryHandle;

	constructor(php: PHP, opfs: FileSystemDirectoryHandle, memfsRoot: string) {
		this.php = php;
		this.opfs = opfs;
		this.memfsRoot = normalizeMemfsPath(memfsRoot);
	}

	private toOpfsPath(path: string) {
		return normalizeMemfsPath(path.substring(this.memfsRoot.length));
	}

	public async processEntry(entry: JournalEntry) {
		if (
			!entry.path.startsWith(this.memfsRoot) ||
			entry.path === this.memfsRoot
		) {
			return;
		}
		const opfsPath = this.toOpfsPath(entry.path);
		const opfsParent = await resolveParent(this.opfs, opfsPath);
		const name = getFilename(opfsPath);
		if (!name) {
			return;
		}

		try {
			if (entry.operation === 'DELETE') {
				try {
					await opfsParent.removeEntry(name, {
						recursive: true,
					});
				} catch {
					// If the directory already doesn't exist, it's fine
				}
			} else if (entry.operation === 'CREATE') {
				if (entry.nodeType === 'directory') {
					await opfsParent.getDirectoryHandle(name, {
						create: true,
					});
				} else {
					await opfsParent.getFileHandle(name, {
						create: true,
					});
				}
			} else if (entry.operation === 'WRITE') {
				await overwriteOpfsFile(
					opfsParent,
					name,
					this.php[__private__dont__use].FS,
					entry.path
				);
			} else if (
				entry.operation === 'RENAME' &&
				entry.toPath.startsWith(this.memfsRoot)
			) {
				const opfsTargetPath = this.toOpfsPath(entry.toPath);
				const opfsTargetParent = await resolveParent(
					this.opfs,
					opfsTargetPath
				);

				if (entry.nodeType === 'directory') {
					const opfsDir = await opfsTargetParent.getDirectoryHandle(
						name,
						{
							create: true,
						}
					);
					// in OPFS, move() doesn't work for directories :-(
					// We have to copy the directory recursively instead.
					await copyMemfsToOpfs(
						this.php[__private__dont__use].FS,
						opfsDir,
						entry.toPath
					);
					// Then delete the old directory
					await opfsParent.removeEntry(name, {
						recursive: true,
					});
				} else {
					/**
					 * Delete the old file and creating a new one.
					 *
					 * We cannot use the OPFS move() method here. Imagine pulling from
					 * a Git repository – each pulled object is first buffered in a
					 * file called ".tmp" and then renamed to its final name. However,
					 * the WRITE operation does not store the written bytes, only the
					 * path.
					 *
					 * By the time the filesystem journal is flushed, we cannot
					 * assume that the "rename from" path still contains the same bytes
					 * as it did when the WRITE operation was executed. Therefore, it's
					 * safer to delete the old file and create a new one.
					 *
					 * It is still possible that the new file was already deleted
					 * or renamed to another location. That's fine. A later stage
					 * of replaying the journal will take care of that.
					 *
					 * Ideally, PHP.wasm would not use journaling at all, but
					 * a native WASMFS layer for handling OPFS.
					 *
					 * See https://github.com/WordPress/wordpress-playground/pull/1878
					 * for more details.
					 */
					try {
						await opfsParent.removeEntry(name);
					} catch {
						// If the directory already doesn't exist, it's fine
					}
					await overwriteOpfsFile(
						opfsTargetParent,
						basename(opfsTargetPath),
						this.php[__private__dont__use].FS,
						entry.toPath
					);
				}
			}
		} catch (e) {
			// Useful for debugging – the original error gets lost in the
			// Comlink proxy.
			logger.log({ entry, name });
			logger.error(e);
			throw e;
		}
	}
}

function normalizeMemfsPath(path: string) {
	return path.replace(/\/$/, '').replace(/\/\/+/g, '/');
}

function getFilename(path: string) {
	return path.substring(path.lastIndexOf('/') + 1);
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

function throttle<T extends (...args: any[]) => any>(
	fn: T,
	debounceMs: number
): T {
	let lastCallTime = 0;
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	let pendingArgs: Parameters<T> | undefined;

	return function throttledCallback(...args: Parameters<T>) {
		pendingArgs = args;

		const timeSinceLastCall = Date.now() - lastCallTime;
		if (timeoutId === undefined) {
			const delay = Math.max(0, debounceMs - timeSinceLastCall);
			timeoutId = setTimeout(() => {
				timeoutId = undefined;
				lastCallTime = Date.now();
				fn(...pendingArgs!);
			}, delay);
		}
	} as T;
}
