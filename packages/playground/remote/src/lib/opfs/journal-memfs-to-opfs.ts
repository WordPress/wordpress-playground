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
import { logger } from '@php-wasm/logger';
import type { WebPHP } from '@php-wasm/web';
import type { EmscriptenFS } from './types';
import { FilesystemOperation, journalFSEvents } from '@php-wasm/fs-journal';
import { __private__dont__use } from '@php-wasm/universal';
import { copyMemfsToOpfs, overwriteOpfsFile } from './bind-opfs';

export function journalFSEventsToOpfs(
	php: WebPHP,
	opfsRoot: FileSystemDirectoryHandle,
	memfsRoot: string
) {
	const journal: FilesystemOperation[] = [];
	const unbindJournal = journalFSEvents(php, memfsRoot, (entry) => {
		journal.push(entry);
	});
	const rewriter = new OpfsRewriter(php, opfsRoot, memfsRoot);

	async function flushJournal() {
		const release = await php.semaphore.acquire();
		try {
			// @TODO This is way too slow in practice, we need to batch the
			// changes into groups of parallelizable operations.
			while (journal.length) {
				await rewriter.processEntry(journal.shift()!);
			}
		} finally {
			release();
		}
	}
	php.addEventListener('request.end', flushJournal);
	return function () {
		unbindJournal();
		php.removeEventListener('request.end', flushJournal);
	};
}

type JournalEntry = FilesystemOperation;

class OpfsRewriter {
	private FS: EmscriptenFS;
	private memfsRoot: string;

	constructor(
		private php: WebPHP,
		private opfs: FileSystemDirectoryHandle,
		memfsRoot: string
	) {
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
				} catch (e) {
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
				const targetName = getFilename(opfsTargetPath);

				if (entry.nodeType === 'directory') {
					const opfsDir = await opfsTargetParent.getDirectoryHandle(
						name,
						{
							create: true,
						}
					);
					// in OPFS, move() doesn't work for directories :-(
					// We have to copy the directory recursively instead.
					await copyMemfsToOpfs(this.php, opfsDir, entry.toPath);
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

// Commenting this out for now to keep TS happy, but we
// definitely need to start processing journal entries
// in parallel again.
//
// async function asyncMap<T, U>(
// 	iter: Iterable<T>,
// 	asyncFunc: (value: T) => Promise<U>
// ): Promise<U[]> {
// 	const promises: Promise<U>[] = [];
// 	for (const value of iter) {
// 		promises.push(asyncFunc(value));
// 	}
// 	return await Promise.all(promises);
// }
