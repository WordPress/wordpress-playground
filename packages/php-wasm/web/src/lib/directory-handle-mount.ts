import type { Emscripten, MountHandler, PHP } from '@php-wasm/universal';
import {
	FSHelpers,
	MountStillActiveError,
	__private__dont__use,
} from '@php-wasm/universal';
import {
	Semaphore,
	basename,
	dirname,
	isParentOf,
	joinPaths,
	normalizePath,
} from '@php-wasm/util';
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
	onMount?: (mount: DirectoryHandleMount) => void;
}
export interface DirectoryHandleMount {
	/**
	 * Replays captured MEMFS changes into OPFS until the journal settles.
	 *
	 * Event capture remains active. If applying a normalized operation fails,
	 * that operation and its unattempted suffix remain queued for retry.
	 */
	flush(): Promise<void>;
	/**
	 * Flushes all captured changes and detaches after a successful drain.
	 *
	 * If draining fails, rejects with `MountStillActiveError` without
	 * detaching, so callers can retry the same mount.
	 */
	unmount(): Promise<void>;
}
export type SyncProgress = {
	/** The number of files that have been synced. */
	files: number;
	/** The number of all files that need to be synced. */
	total: number;
	/** The current stage of the initial sync. */
	phase?: 'copying' | 'flushing';
};
export type SyncProgressCallback = (
	progress: SyncProgress
) => void | Promise<void>;

interface JournalFSEventsToOpfsOptions {
	maxFlushPasses?: number;
	initialSync?: Promise<void>;
}

const DEFAULT_MAX_OPFS_FLUSH_PASSES = 1000;
const SYMLINKS_FILENAME = '.playground-symlinks.json';

/**
 * Creates a PHP mount handler backed by an OPFS directory.
 *
 * During MEMFS-to-OPFS setup, journaling starts before the initial copy so
 * writes made during setup are captured. If copying or reporting its progress
 * fails, it discards the incomplete mount without replacing the original
 * setup error. Successful mounts use the retryable final-flush contract of
 * `DirectoryHandleMount`.
 */
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
			const mount = journalFSEventsToOpfs(php, handle, vfsMountPoint);
			options.onMount?.(mount);
			return mount.unmount;
		} else {
			let finishInitialSync!: () => void;
			const initialSync = new Promise<void>((resolve) => {
				finishInitialSync = resolve;
			});
			const mount = journalFSEventsToOpfs(php, handle, vfsMountPoint, {
				initialSync,
			});
			options.onMount?.(mount);
			let lastProgress: SyncProgress | undefined;
			try {
				await copyMemfsToOpfs(
					FS,
					handle,
					vfsMountPoint,
					async (progress) => {
						lastProgress = {
							...progress,
							phase: 'copying',
						};
						await options.initialSync.onProgress?.(lastProgress);
					}
				);
				finishInitialSync();
				await options.initialSync.onProgress?.({
					files: lastProgress?.files ?? 0,
					total: lastProgress?.total ?? 0,
					phase: 'flushing',
				});
				void mount.flush().catch((error) => {
					logger.error('OPFS flush failed after initial sync', {
						error,
						vfsMountPoint,
					});
				});
			} catch (error) {
				finishInitialSync();
				// Setup never completed, so there is no valid mount to keep retryable.
				await mount.discard();
				throw error;
			}
			return mount.unmount;
		}
	};
}

/**
 * Restores saved files while bounding both active reads and queued promises.
 * Outstanding reads settle before a failed restore returns, so retrying the
 * mount cannot overlap writes from the previous attempt.
 */
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
	let symlinks = new Map<string, string>();
	let copyError: unknown;
	const stack: Array<[FileSystemDirectoryHandle, string]> = [
		[opfsRoot, memfsRoot],
	];
	try {
		while (stack.length > 0) {
			const [opfsParent, memfsParentPath] = stack.pop()!;

			for await (const opfsHandle of opfsParent.values()) {
				// Acquire before creating the promise. Queuing the entire site then
				// repeatedly awaiting Promise.any(ops) attaches callbacks to every
				// queued read and can exhaust the JS heap on large saved sites.
				const release = await semaphore.acquire();
				if (copyError !== undefined) {
					release();
					throw copyError;
				}
				const op = (async () => {
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
						if (
							memfsParentPath === memfsRoot &&
							opfsHandle.name === SYMLINKS_FILENAME
						) {
							symlinks = parseSavedSymlinks(await file.text());
							return;
						}
						const byteArray = new Uint8Array(
							await file.arrayBuffer()
						);
						FS.createDataFile(
							memfsParentPath,
							opfsHandle.name,
							byteArray,
							true,
							true,
							true
						);
					}
				})()
					.catch((error) => {
						copyError ??= error;
					})
					.finally(() => {
						ops.splice(ops.indexOf(op), 1);
						release();
					});
				ops.push(op);
			}
			// Let the ongoing operations catch-up to the stack.
			while (stack.length === 0 && ops.length > 0) {
				await Promise.any(ops);
			}
		}
	} finally {
		// Finish outstanding reads before a failed mount can be retried.
		await Promise.all(ops);
	}
	if (copyError !== undefined) throw copyError;
	// Targets may be missing, outside the mount, or links themselves. Restore
	// the links only after all real directories and files have been copied.
	for (const [path, target] of symlinks) {
		FS.symlink(target, joinPaths(memfsRoot, path));
	}
}

export async function copyMemfsToOpfs(
	FS: Emscripten.RootFS,
	opfsRoot: FileSystemDirectoryHandle,
	memfsRoot: string,
	onProgress?: SyncProgressCallback
) {
	// Validate an existing sidecar before replacing it. An unrelated file with
	// this reserved name must not be silently overwritten.
	const previousSymlinks = await readSavedSymlinks(opfsRoot);
	// Ensure the memfs directory exists.
	if (!FSHelpers.fileExists(FS, memfsRoot)) {
		FS.mkdirTree(memfsRoot);
	}
	const symlinks = new Map<string, string>();
	await copyMemfsTreeToOpfs(
		FS,
		opfsRoot,
		memfsRoot,
		symlinks,
		'/',
		onProgress
	);
	if (symlinks.size || previousSymlinks.size) {
		await writeSavedSymlinks(opfsRoot, symlinks);
	}
}

async function copyMemfsTreeToOpfs(
	FS: Emscripten.RootFS,
	opfsRoot: FileSystemDirectoryHandle,
	memfsRoot: string,
	symlinks: Map<string, string>,
	relativeRoot: string,
	onProgress?: SyncProgressCallback
) {
	// Create all MEMFS directories in OPFS but don't create
	// files yet. This is quite fast.
	const filesToCreate: Array<[FileSystemDirectoryHandle, string, string]> =
		[];
	async function mirrorMemfsDirectoryinOpfs(
		memfsParent: string,
		opfsDir: FileSystemDirectoryHandle,
		relativeParent: string
	) {
		await Promise.all(
			FS.readdir(memfsParent)
				.filter(
					(entryName: string) =>
						entryName !== '.' && entryName !== '..'
				)
				.map(async (entryName: string) => {
					const memfsPath = joinPaths(memfsParent, entryName);
					const relativePath = joinPaths(relativeParent, entryName);
					if (relativePath === '/' + SYMLINKS_FILENAME) {
						throw new Error(
							`${SYMLINKS_FILENAME} is reserved for saved symlinks`
						);
					}
					const node = FS.lookupPath(memfsPath, {
						follow: false,
					}).node;
					if (FS.isLink(node.mode)) {
						symlinks.set(relativePath, FS.readlink(memfsPath));
						// Older saves may have copied the target at this path.
						await removeOpfsEntry(opfsDir, entryName);
						return;
					}
					if (!FS.isDir(node.mode)) {
						filesToCreate.push([opfsDir, memfsPath, entryName]);
						return;
					}

					const handle = await opfsDir.getDirectoryHandle(entryName, {
						create: true,
					});
					return await mirrorMemfsDirectoryinOpfs(
						memfsPath,
						handle,
						relativePath
					);
				})
		);
	}
	await mirrorMemfsDirectoryinOpfs(memfsRoot, opfsRoot, relativeRoot);

	// Now let's create all the required files in OPFS. This can be quite slow
	// so we report progress. Throttle the progress callback to avoid flooding
	// the main thread with excessive updates.
	let numFilesCompleted = 0;
	await onProgress?.({
		files: numFilesCompleted,
		total: filesToCreate.length,
	});
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
	// Records any file whose OPFS write rejected. A single failed write must
	// fail the whole copy: otherwise a rejection that loses the `Promise.race`
	// below — or that lands in the final sub-`maxConcurrentWrites` batch, which
	// is never raced — would be swallowed by the `allSettled` in the finally,
	// and the copy would resolve as "100% complete" while silently missing a
	// file. That is how a saved Playground lands on disk without, say,
	// wp-includes/sodium_compat/autoload.php and then fatals on the next boot.
	const failedWrites: Array<{ memfsPath: string; error: unknown }> = [];

	try {
		for (const [opfsDir, memfsPath, entryName] of filesToCreate) {
			const promise = overwriteOpfsFile(opfsDir, entryName, FS, memfsPath)
				.then(
					() => {
						numFilesCompleted++;
						throttledProgressCallback?.({
							files: numFilesCompleted,
							total: filesToCreate.length,
						});
					},
					// Record the rejection rather than letting it escape here;
					// it is re-raised as one error once every write has settled.
					(error) => {
						failedWrites.push({ memfsPath, error });
					}
				)
				.finally(() => {
					concurrentWrites.delete(promise);
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
	throttledProgressCallback?.cancel();

	// Fail loud: a partial copy must reject so callers treat the save as failed
	// (leaving the temporary-placeholder / "initial sync pending" markers in
	// place) instead of recording a complete, durable save that cannot boot.
	if (failedWrites.length > 0) {
		const failedNames = failedWrites
			.map(({ memfsPath }) => memfsPath)
			.join(', ');
		throw new Error(
			`Failed to copy ${failedWrites.length} of ${filesToCreate.length} ` +
				`file(s) to OPFS (${failedNames}). The save is incomplete.`,
			{ cause: failedWrites[0].error }
		);
	}

	await onProgress?.({
		files: filesToCreate.length,
		total: filesToCreate.length,
	});
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

	await writeOpfsFile(opfsParent, name, buffer);
}

async function writeOpfsFile(
	opfsParent: FileSystemDirectoryHandle,
	name: string,
	buffer: Uint8Array
) {
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
	} catch (error) {
		// A failed write can leave the stream errored. Closing it would hide
		// the useful cause (for example, exceeded storage quota) behind a TypeError.
		try {
			if ('abort' in writer) await writer.abort();
			else await writer.close();
		} catch {
			// Preserve the write failure even if cleanup also fails.
		}
		throw error;
	}
	await writer.close();
}

async function readSavedSymlinks(opfsRoot: FileSystemDirectoryHandle) {
	let handle;
	try {
		handle = await opfsRoot.getFileHandle(SYMLINKS_FILENAME);
	} catch (error) {
		if ((error as DOMException).name === 'NotFoundError') {
			return new Map<string, string>();
		}
		throw error;
	}
	return parseSavedSymlinks(await (await handle.getFile()).text());
}

function parseSavedSymlinks(json: string): Map<string, string> {
	const data = JSON.parse(json);
	if (
		data?.version !== 1 ||
		!data.links ||
		typeof data.links !== 'object' ||
		Array.isArray(data.links)
	) {
		throw new Error(`Invalid ${SYMLINKS_FILENAME}`);
	}
	const symlinks = new Map<string, string>();
	for (const [path, target] of Object.entries(data.links)) {
		if (
			!path.startsWith('/') ||
			path === '/' ||
			normalizePath(path) !== path ||
			path.includes('\0') ||
			path === '/' + SYMLINKS_FILENAME ||
			typeof target !== 'string' ||
			!target ||
			target.includes('\0')
		) {
			throw new Error(`Invalid saved symlink: ${path}`);
		}
		symlinks.set(path, target);
	}
	for (const path of symlinks.keys()) {
		for (
			let parent = dirname(path);
			parent !== '/';
			parent = dirname(parent)
		) {
			if (symlinks.has(parent)) {
				throw new Error(
					`Saved symlink ${path} is inside another symlink`
				);
			}
		}
	}
	return symlinks;
}

async function writeSavedSymlinks(
	opfsRoot: FileSystemDirectoryHandle,
	symlinks: Map<string, string>
) {
	if (symlinks.size === 0) {
		await removeOpfsEntry(opfsRoot, SYMLINKS_FILENAME);
		return;
	}
	let existed = true;
	try {
		await opfsRoot.getFileHandle(SYMLINKS_FILENAME);
	} catch (error) {
		if ((error as DOMException).name !== 'NotFoundError') throw error;
		existed = false;
	}
	try {
		await writeOpfsFile(
			opfsRoot,
			SYMLINKS_FILENAME,
			new TextEncoder().encode(
				JSON.stringify({
					version: 1,
					links: Object.fromEntries(symlinks),
				})
			)
		);
	} catch (error) {
		// Creating the handle leaves an empty file even if opening the writer
		// fails. Remove that new file so a retry does not read it as a broken index.
		if (!existed) {
			try {
				await removeOpfsEntry(opfsRoot, SYMLINKS_FILENAME);
			} catch (cleanupError) {
				logger.error(cleanupError);
			}
		}
		throw error;
	}
}

async function removeOpfsEntry(
	parent: FileSystemDirectoryHandle,
	name: string
) {
	try {
		await parent.removeEntry(name, { recursive: true });
	} catch (error) {
		if ((error as DOMException).name !== 'NotFoundError') throw error;
	}
}

/**
 * Mirrors MEMFS changes below a mount point to an OPFS directory.
 *
 * The returned `flush()` persists changes without detaching. `unmount()` drains
 * the journal and detaches only after a successful drain. `discard()` stops
 * capture without starting a final flush, then waits for any flush already in
 * flight. `unmount()` uses it after a successful drain; failed initial setup
 * uses it to abandon an incomplete mount.
 */
export function journalFSEventsToOpfs(
	php: PHP,
	opfsRoot: FileSystemDirectoryHandle,
	memfsRoot: string,
	options: JournalFSEventsToOpfsOptions = {}
) {
	const journal: FilesystemOperation[] = [];
	const unbindJournal = journalFSEvents(php, memfsRoot, (entry) => {
		journal.push(entry);
	});
	const rewriter = new OpfsRewriter(php, opfsRoot, memfsRoot);
	let flushPromise: Promise<void> | undefined;

	/**
	 * Drains the journal without detaching its listeners.
	 *
	 * Concurrent callers share the same in-flight promise.
	 */
	function flush() {
		if (flushPromise === undefined) {
			flushPromise = flushJournal().finally(() => {
				flushPromise = undefined;
			});
		}
		return flushPromise;
	}

	/**
	 * Drains the journal and detaches its listeners as one commit boundary.
	 *
	 * A failed drain leaves the journal attached and throws
	 * `MountStillActiveError`, allowing the same mount to be retried.
	 */
	async function unmount() {
		try {
			while (true) {
				await flush();
				if (journal.length === 0) {
					// discard() removes the listeners synchronously before its first
					// await, so nothing can be captured after this empty check.
					await discard();
					return;
				}
			}
		} catch (error) {
			throw new MountStillActiveError(error);
		}
	}

	/**
	 * Stops capturing changes without starting another flush.
	 *
	 * An in-flight flush may continue processing queued entries. Use this only
	 * after `unmount()` has observed an empty journal or while rolling back failed
	 * setup. It waits for that flush, but logs its failure so the setup error
	 * remains the one returned to the caller.
	 */
	async function discard() {
		const inFlightFlush = flushPromise;
		unbindJournal();
		php.removeEventListener('request.end', flushInBackground);
		php.removeEventListener('proxyfs.request.end', flushInBackground);
		php.removeEventListener('filesystem.write', flushInBackground);
		try {
			await inFlightFlush;
		} catch (error) {
			// Setup rollback must finish outstanding writes, but its original copy
			// error remains the useful failure for the caller.
			logger.error('OPFS flush failed while discarding a mount', error);
		}
	}

	function flushInBackground() {
		void flush().catch((error) => {
			logger.error(error);
		});
	}

	async function flushJournal() {
		// Initial copying and replay both write the symlink index. Capture
		// changes during setup, but replay them only after that copy finishes.
		await options.initialSync;
		// A failed index write can leave an empty journal. Retry that write even
		// when there are no new filesystem operations to replay.
		if (journal.length === 0) {
			await rewriter.flushSymlinks();
		}
		const maxFlushPasses =
			options.maxFlushPasses ?? DEFAULT_MAX_OPFS_FLUSH_PASSES;
		for (let pass = 0; journal.length > 0; pass++) {
			if (pass >= maxFlushPasses) {
				const remainingEntries = journal.length;
				const remainingPhrase =
					remainingEntries === 1
						? `${remainingEntries} journal entry remains`
						: `${remainingEntries} journal entries remain`;
				throw new Error(
					`OPFS flush for "${memfsRoot}" did not settle after ${maxFlushPasses} journal batches; ${remainingPhrase}. This can happen when filesystem writes are continuously enqueued while flushing.`
				);
			}
			await flushJournalOnce();
		}
	}

	/**
	 * Replays one normalized journal batch while holding PHP's execution semaphore.
	 *
	 * If replay fails, restores the failed operation and its unattempted suffix
	 * ahead of events captured during replay. Completed operations are not
	 * retried because moves and deletes are not generally safe to apply twice.
	 * Saves the symlink index once after replay; a failed index write stays
	 * pending without putting completed filesystem operations back in the journal.
	 */
	async function flushJournalOnce() {
		if (journal.length === 0) {
			return;
		}

		const release = await php.semaphore.acquire();

		// Remove exactly this snapshot. Filesystem hooks may append entries while
		// this batch awaits OPFS, and those newer entries must remain in the journal.
		const journalEntries = [...journal];
		journal.splice(0, journalEntries.length);

		const compressedJournal = normalizeFilesystemOperations(journalEntries);
		let processedEntryCount = 0;
		try {
			// @TODO This is way too slow in practice, we need to batch the
			// changes into groups of parallelizable operations.
			for (const entry of compressedJournal) {
				await rewriter.processEntry(entry);
				processedEntryCount++;
			}
			await rewriter.flushSymlinks();
		} catch (error) {
			// Put the failed operation and unattempted remainder back ahead of
			// events captured while this batch was replaying.
			journal.unshift(...compressedJournal.slice(processedEntryCount));
			throw error;
		} finally {
			release();
		}
	}

	php.addEventListener('request.end', flushInBackground);
	// Replica writes enter this journal through PROXYFS, but their request.end
	// event fires only on the replica. Flush when proxyFileSystem forwards it.
	php.addEventListener('proxyfs.request.end', flushInBackground);
	php.addEventListener('filesystem.write', flushInBackground);
	return {
		flush,
		unmount,
		discard,
	};
}

type JournalEntry = FilesystemOperation;

class OpfsRewriter {
	private memfsRoot: string;
	private php: PHP;
	private opfs: FileSystemDirectoryHandle;
	private symlinks?: Map<string, string>;
	private symlinksDirty = false;

	constructor(php: PHP, opfs: FileSystemDirectoryHandle, memfsRoot: string) {
		this.php = php;
		this.opfs = opfs;
		this.memfsRoot = normalizeMemfsPath(memfsRoot);
	}

	private toOpfsPath(path: string) {
		return normalizeMemfsPath(path.substring(this.memfsRoot.length));
	}

	/**
	 * Applies one normalized MEMFS journal operation to OPFS.
	 *
	 * Destructive steps tolerate an already-missing source because a previous
	 * attempt may mutate OPFS before reporting failure and then be retried.
	 */
	public async processEntry(entry: JournalEntry) {
		if (
			!isParentOf(this.memfsRoot, entry.path) ||
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
			if (opfsPath === '/' + SYMLINKS_FILENAME) {
				throw new Error(
					`${SYMLINKS_FILENAME} is reserved for saved symlinks`
				);
			}
			this.symlinks ??= await readSavedSymlinks(this.opfs);
			const symlinksChanged =
				entry.operation === 'DELETE' || entry.operation === 'RENAME'
					? removeSavedSymlinks(this.symlinks, opfsPath)
					: this.symlinks.delete(opfsPath);
			this.symlinksDirty ||= symlinksChanged;
			if (
				entry.operation === 'DELETE' ||
				(entry.operation === 'RENAME' &&
					!isParentOf(this.memfsRoot, entry.toPath))
			) {
				try {
					await opfsParent.removeEntry(name, {
						recursive: true,
					});
				} catch (error) {
					if ((error as DOMException).name !== 'NotFoundError')
						throw error;
					// If the directory already doesn't exist, it's fine
				}
			} else if (entry.operation === 'CREATE') {
				if (entry.nodeType === 'symlink') {
					await removeOpfsEntry(opfsParent, name);
					this.symlinks.set(opfsPath, entry.target);
					this.symlinksDirty = true;
				} else if (entry.nodeType === 'directory') {
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
				isParentOf(this.memfsRoot, entry.toPath)
			) {
				const opfsTargetPath = this.toOpfsPath(entry.toPath);
				if (opfsTargetPath === '/' + SYMLINKS_FILENAME) {
					throw new Error(
						`${SYMLINKS_FILENAME} is reserved for saved symlinks`
					);
				}
				this.symlinksDirty =
					removeSavedSymlinks(this.symlinks, opfsTargetPath) ||
					this.symlinksDirty;
				const opfsTargetParent = await resolveParent(
					this.opfs,
					opfsTargetPath
				);

				if (entry.nodeType === 'symlink') {
					await removeOpfsEntry(opfsParent, name);
					await removeOpfsEntry(
						opfsTargetParent,
						basename(opfsTargetPath)
					);
					this.symlinks.set(opfsTargetPath, entry.target);
					this.symlinksDirty = true;
				} else if (entry.nodeType === 'directory') {
					const opfsDir = await opfsTargetParent.getDirectoryHandle(
						basename(opfsTargetPath),
						{
							create: true,
						}
					);
					// in OPFS, move() doesn't work for directories :-(
					// We have to copy the directory recursively instead.
					const FS = this.php[__private__dont__use].FS;
					// A later move or replacement may have removed this directory.
					// Do not recreate it in MEMFS or follow a replacement link.
					if (
						FSHelpers.fileExists(FS, entry.toPath) &&
						FS.isDir(
							FS.lookupPath(entry.toPath, { follow: false }).node
								.mode
						)
					) {
						await copyMemfsTreeToOpfs(
							FS,
							opfsDir,
							entry.toPath,
							this.symlinks,
							opfsTargetPath
						);
					}
					this.symlinksDirty = true;
					// Then delete the old directory. A retry may observe that a
					// previous attempt removed it before reporting an error.
					try {
						await opfsParent.removeEntry(name, {
							recursive: true,
						});
					} catch (error) {
						if ((error as DOMException).name !== 'NotFoundError') {
							throw error;
						}
						// A previous attempt already completed the removal.
					}
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

	public async flushSymlinks() {
		if (!this.symlinksDirty) {
			return;
		}
		// Keep a changed index dirty until it is saved. On retry, deletion
		// may already be reflected in the map, but its write still needs to run.
		await writeSavedSymlinks(this.opfs, this.symlinks!);
		this.symlinksDirty = false;
	}
}

function removeSavedSymlinks(symlinks: Map<string, string>, path: string) {
	let changed = false;
	for (const linkPath of symlinks.keys()) {
		if (isParentOf(path, linkPath)) {
			symlinks.delete(linkPath);
			changed = true;
		}
	}
	return changed;
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

type CancelableThrottledFunction<T extends (...args: any[]) => any> = T & {
	cancel(): void;
};

function throttle<T extends (...args: any[]) => any>(
	fn: T,
	debounceMs: number
): CancelableThrottledFunction<T> {
	let lastCallTime = 0;
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	let pendingArgs: Parameters<T> | undefined;

	const throttledCallback = function throttledCallback(
		...args: Parameters<T>
	) {
		pendingArgs = args;

		const timeSinceLastCall = Date.now() - lastCallTime;
		if (timeoutId === undefined) {
			const delay = Math.max(0, debounceMs - timeSinceLastCall);
			timeoutId = setTimeout(() => {
				timeoutId = undefined;
				lastCallTime = Date.now();
				const args = pendingArgs!;
				pendingArgs = undefined;
				try {
					void Promise.resolve(fn(...args)).catch(
						logThrottledProgressCallbackError
					);
				} catch (error) {
					logThrottledProgressCallbackError(error);
				}
			}, delay);
		}
	} as CancelableThrottledFunction<T>;

	throttledCallback.cancel = () => {
		if (timeoutId !== undefined) {
			clearTimeout(timeoutId);
		}
		timeoutId = undefined;
		pendingArgs = undefined;
	};

	return throttledCallback;
}

function logThrottledProgressCallbackError(error: unknown) {
	logger.error('Throttled progress callback failed', { error });
}
