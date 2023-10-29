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
import type { EmscriptenFS } from './types';
import {
	PHPFilesystemEvent,
	journalMemfs,
	MemfsJournal,
} from '@php-wasm/universal';
import { __private__dont__use } from '@php-wasm/universal';
import { copyMemfsToOpfs, overwriteOpfsFile } from './bind-opfs';

export function journalMemfsToOpfs(
	php: WebPHP,
	opfsRoot: FileSystemDirectoryHandle,
	memfsRoot: string
) {
	const journal = journalMemfs(php, memfsRoot);
	const rewriter = new OpfsRewriter(php, journal, opfsRoot, memfsRoot);
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
		const response = await originalRun.apply(php, args);
		await rewriter.flush();
		return response;
	};
	return () => {
		journal.unbind();
	};
}

type JournalEntry = PHPFilesystemEvent['details'];

class OpfsRewriter {
	private FS: EmscriptenFS;
	private entries: JournalEntry[][] = [];
	private memfsRoot: string;

	constructor(
		private php: WebPHP,
		private journal: MemfsJournal,
		private opfs: FileSystemDirectoryHandle,
		memfsRoot: string
	) {
		this.memfsRoot = normalizeMemfsPath(memfsRoot);
		this.FS = this.php[__private__dont__use].FS;
	}

	async flush() {
		const partitions = this.journal.flush();

		for (const partition of partitions) {
			await asyncMap(partition, async (entry) => {
				await this.processEntry(entry);
			});
		}
	}

	private toOpfsPath(path: string) {
		return normalizeMemfsPath(path.substring(this.memfsRoot.length));
	}

	private async processEntry(entry: JournalEntry) {
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
			} else if (entry.operation === 'CREATE_DIRECTORY') {
				await opfsParent.getDirectoryHandle(name, {
					create: true,
				});
			} else if (entry.operation === 'UPDATE_FILE') {
				await overwriteOpfsFile(opfsParent, name, this.FS, entry.path);
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
			console.log({ entry, name });
			console.error(e);
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
