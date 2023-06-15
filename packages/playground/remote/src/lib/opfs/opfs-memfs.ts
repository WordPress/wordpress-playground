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
import { EmscriptenFS } from './types';

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
	const accessHandle = await opfsFile.createSyncAccessHandle();
	try {
		await accessHandle.truncate(0);
		await accessHandle.write(buffer);
	} finally {
		await accessHandle.close();
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
