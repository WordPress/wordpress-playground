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
import { PHP, __private__dont__use } from '@php-wasm/universal';
import { Semaphore, joinPaths } from '@php-wasm/util';
import { EmscriptenFS } from './types';
import { journalFSEventsToOpfs } from './journal-memfs-to-opfs';

let unbindOpfs: (() => void) | undefined;
export type SyncProgress = {
	/** The number of files that have been synced. */
	files: number;
	/** The number of all files that need to be synced. */
	total: number;
};
export type SyncProgressCallback = (progress: SyncProgress) => void;
export type BindOpfsOptions = {
	php: PHP;
	opfs: FileSystemDirectoryHandle;
	wordPressAvailableInOPFS?: boolean;
	onProgress?: SyncProgressCallback;
};
export async function bindOpfs({
	php,
	opfs,
	wordPressAvailableInOPFS,
	onProgress,
}: BindOpfsOptions) {
	if (unbindOpfs) {
		await unbindOpfs();
	}

	const docroot = php.documentRoot;

	if (wordPressAvailableInOPFS === undefined) {
		wordPressAvailableInOPFS = await playgroundAvailableInOpfs(opfs);
	}

	// Setup sync between MEMFS and the local directory
	if (wordPressAvailableInOPFS) {
		/**
		 * Remove DOCROOT in MEMFS to make space for the new one.
		 * This is an in-memory operation and doesn't affect any
		 * persisted files.
		 */
		try {
			if (php.isDir(docroot)) {
				php.rmdir(docroot, { recursive: true });
				php.mkdirTree(docroot);
			}
		} catch (e) {
			// Ignore any errors
		}

		await copyOpfsToMemfs(php, opfs, docroot);
	} else {
		await copyMemfsToOpfs(php, opfs, docroot, onProgress);
	}

	unbindOpfs = journalFSEventsToOpfs(php, opfs, docroot);
}

export async function copyOpfsToMemfs(
	php: PHP,
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

export async function copyMemfsToOpfs(
	php: PHP,
	opfsRoot: FileSystemDirectoryHandle,
	memfsRoot: string,
	onProgress?: SyncProgressCallback
) {
	const PHPRuntime = php[__private__dont__use];
	const FS = PHPRuntime.FS;
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

	// Now let's create all the required files in OPFS. This is quite slow
	// so we report progress.
	let i = 0;
	const filesCreated = filesToCreate.map(([opfsDir, memfsPath, entryName]) =>
		overwriteOpfsFile(opfsDir, entryName, FS, memfsPath).then(() => {
			onProgress?.({ files: ++i, total: filesToCreate.length });
		})
	);
	await Promise.all(filesCreated);
}

function isMemfsDir(FS: EmscriptenFS, path: string) {
	return FS.isDir(FS.lookupPath(path, { follow: true }).node.mode);
}

export async function overwriteOpfsFile(
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
		try {
			await writer.close();
		} catch (e) {
			// Ignore errors
			console.error(e);
		}
	}
}

export async function opfsFileExists(
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

export async function playgroundAvailableInOpfs(
	opfs: FileSystemDirectoryHandle
) {
	try {
		/**
		 * Assume it's a Playground directory if these files exist:
		 * - wp-config.php
		 * - wp-content/database/.ht.sqlite
		 */
		await opfs.getFileHandle('wp-config.php', { create: false });
		const wpContent = await opfs.getDirectoryHandle('wp-content', {
			create: false,
		});
		const database = await wpContent.getDirectoryHandle('database', {
			create: false,
		});
		await database.getFileHandle('.ht.sqlite', { create: false });
	} catch (e) {
		return false;
	}
	return true;
}
