import { Emscripten } from './emscripten-types';
import {
	getEmscriptenFsError,
	rethrowFileSystemError,
} from './rethrow-file-system-error';
import { logger } from '@php-wasm/logger';
import { dirname, joinPaths } from '@php-wasm/util';

export interface RmDirOptions {
	/**
	 * If true, recursively removes the directory and all its contents.
	 * Default: true.
	 */
	recursive?: boolean;
}

export interface ListFilesOptions {
	/**
	 * If true, prepend given folder path to all file names.
	 * Default: false.
	 */
	prependPath: boolean;
}

export class FSHelpers {
	/**
	 * Reads a file from the PHP filesystem and returns it as a string.
	 *
	 * @throws {@link @php-wasm/universal:ErrnoError} – If the file doesn't exist.
	 * @param FS
	 * @param  path - The file path to read.
	 * @returns The file contents.
	 */
	@rethrowFileSystemError('Could not read "{path}"')
	static readFileAsText(FS: Emscripten.RootFS, path: string) {
		return new TextDecoder().decode(FSHelpers.readFileAsBuffer(FS, path));
	}

	/**
	 * Reads a file from the PHP filesystem and returns it as an array buffer.
	 *
	 * @throws {@link @php-wasm/universal:ErrnoError} – If the file doesn't exist.
	 * @param FS
	 * @param  path - The file path to read.
	 * @returns The file contents.
	 */
	@rethrowFileSystemError('Could not read "{path}"')
	static readFileAsBuffer(FS: Emscripten.RootFS, path: string): Uint8Array {
		return FS.readFile(path);
	}

	/**
	 * Overwrites data in a file in the PHP filesystem.
	 * Creates a new file if one doesn't exist yet.
	 *
	 * @param FS
	 * @param  path - The file path to write to.
	 * @param  data - The data to write to the file.
	 */
	@rethrowFileSystemError('Could not write to "{path}"')
	static writeFile(
		FS: Emscripten.RootFS,
		path: string,
		data: string | Uint8Array
	) {
		FS.writeFile(path, data);
	}

	/**
	 * Removes a file from the PHP filesystem.
	 *
	 * @throws {@link @php-wasm/universal:ErrnoError} – If the file doesn't exist.
	 * @param FS
	 * @param  path - The file path to remove.
	 */
	@rethrowFileSystemError('Could not unlink "{path}"')
	static unlink(FS: Emscripten.RootFS, path: string) {
		FS.unlink(path);
	}

	/**
	 * Moves a file or directory in the PHP filesystem to a
	 * new location.
	 *
	 * @param FS
	 * @param fromPath The path to rename.
	 * @param toPath The new path.
	 */
	static mv(FS: Emscripten.RootFS, fromPath: string, toPath: string) {
		try {
			// FS.rename moves the inode within the same filesystem.
			// If fromPath and toPath are on different filesystems,
			// the operation will fail. In that case, we need to do
			// a recursive copy of all the files and remove the original.
			// Note this is also what happens in the linux `mv` command.
			const fromMount = FS.lookupPath(fromPath).node.mount;
			const toMount = FSHelpers.fileExists(FS, toPath)
				? FS.lookupPath(toPath).node.mount
				: FS.lookupPath(dirname(toPath)).node.mount;
			const movingBetweenFilesystems =
				fromMount.mountpoint !== toMount.mountpoint;

			if (movingBetweenFilesystems) {
				FSHelpers.copyRecursive(FS, fromPath, toPath);
				FSHelpers.rmdir(FS, fromPath, { recursive: true });
			} else {
				FS.rename(fromPath, toPath);
			}
		} catch (e) {
			const errmsg = getEmscriptenFsError(e);
			if (!errmsg) {
				throw e;
			}
			throw new Error(
				`Could not move ${fromPath} to ${toPath}: ${errmsg}`,
				{
					cause: e,
				}
			);
		}
	}

	/**
	 * Removes a directory from the PHP filesystem.
	 *
	 * @param FS
	 * @param path The directory path to remove.
	 * @param options Options for the removal.
	 */
	@rethrowFileSystemError('Could not remove directory "{path}"')
	static rmdir(
		FS: Emscripten.RootFS,
		path: string,
		options: RmDirOptions = { recursive: true }
	) {
		if (options?.recursive) {
			FSHelpers.listFiles(FS, path).forEach((file) => {
				const filePath = `${path}/${file}`;
				if (FSHelpers.isDir(FS, filePath)) {
					FSHelpers.rmdir(FS, filePath, options);
				} else {
					FSHelpers.unlink(FS, filePath);
				}
			});
		}
		FS.rmdir(path);
	}

	/**
	 * Lists the files and directories in the given directory.
	 *
	 * @param FS
	 * @param  path - The directory path to list.
	 * @param  options - Options for the listing.
	 * @returns The list of files and directories in the given directory.
	 */
	@rethrowFileSystemError('Could not list files in "{path}"')
	static listFiles(
		FS: Emscripten.RootFS,
		path: string,
		options: ListFilesOptions = { prependPath: false }
	): string[] {
		if (!FSHelpers.fileExists(FS, path)) {
			return [];
		}
		try {
			const files = FS.readdir(path).filter(
				(name: string) => name !== '.' && name !== '..'
			);
			if (options.prependPath) {
				const prepend = path.replace(/\/$/, '');
				return files.map((name: string) => `${prepend}/${name}`);
			}
			return files;
		} catch (e) {
			logger.error(e, { path });
			return [];
		}
	}

	/**
	 * Checks if a directory exists in the PHP filesystem.
	 *
	 * @param FS
	 * @param  path – The path to check.
	 * @returns True if the path is a directory, false otherwise.
	 */
	@rethrowFileSystemError('Could not stat "{path}"')
	static isDir(FS: Emscripten.RootFS, path: string): boolean {
		if (!FSHelpers.fileExists(FS, path)) {
			return false;
		}
		return FS.isDir(FS.lookupPath(path, { follow: true }).node.mode);
	}

	/**
	 * Checks if a file exists in the PHP filesystem.
	 *
	 * @param FS
	 * @param  path – The path to check.
	 * @returns True if the path is a file, false otherwise.
	 */
	@rethrowFileSystemError('Could not stat "{path}"')
	static isFile(FS: Emscripten.RootFS, path: string): boolean {
		if (!FSHelpers.fileExists(FS, path)) {
			return false;
		}
		return FS.isFile(FS.lookupPath(path, { follow: true }).node.mode);
	}

	/**
	 * Creates a symlink in the PHP filesystem.
	 *
	 * @param FS
	 * @param target
	 * @param link
	 */
	static symlink(FS: Emscripten.RootFS, target: string, link: string): any {
		return FS.symlink(target, link);
	}

	/**
	 * Checks if a path is a symlink in the PHP filesystem.
	 *
	 * @param FS
	 * @param path
	 * @returns True if the path is a symlink, false otherwise.
	 */
	static isSymlink(FS: Emscripten.RootFS, path: string): boolean {
		if (!FSHelpers.fileExists(FS, path)) {
			return false;
		}

		return FS.isLink(FS.lookupPath(path).node.mode);
	}

	/**
	 * Reads the target of a symlink in the PHP filesystem.
	 * @param FS
	 * @param path
	 * @returns The target of the symlink.
	 * @throws {@link @php-wasm/universal:ErrnoError} – If the path is not a symlink.
	 */
	static readlink(FS: Emscripten.RootFS, path: string): string {
		return FS.readlink(path);
	}

	/**
	 * Gets the real path of a file in the PHP filesystem.
	 * @param FS
	 * @param path
	 *
	 * @returns The real path of the file.
	 */
	@rethrowFileSystemError('Could not stat "{path}"')
	static realpath(FS: Emscripten.RootFS, path: string): string {
		return FS.lookupPath(path, { follow: true }).path;
	}

	/**
	 * Checks if a file (or a directory) exists in the PHP filesystem.
	 *
	 * @param FS
	 * @param  path - The file path to check.
	 * @returns True if the file exists, false otherwise.
	 */
	@rethrowFileSystemError('Could not stat "{path}"')
	static fileExists(FS: Emscripten.RootFS, path: string): boolean {
		try {
			FS.lookupPath(path);
			return true;
		} catch (e) {
			return false;
		}
	}

	/**
	 * Recursively creates a directory with the given path in the PHP filesystem.
	 * For example, if the path is `/root/php/data`, and `/root` already exists,
	 * it will create the directories `/root/php` and `/root/php/data`.
	 *
	 * @param FS
	 * @param  path - The directory path to create.
	 */
	@rethrowFileSystemError('Could not create directory "{path}"')
	static mkdir(FS: Emscripten.RootFS, path: string) {
		FS.mkdirTree(path);
	}

	@rethrowFileSystemError('Could not copy files from "{path}"')
	static copyRecursive(
		FS: Emscripten.FileSystemInstance,
		fromPath: string,
		toPath: string
	) {
		const fromNode = FS.lookupPath(fromPath).node;
		if (FS.isDir(fromNode.mode)) {
			FS.mkdirTree(toPath);
			const filenames = FS.readdir(fromPath).filter(
				(name: string) => name !== '.' && name !== '..'
			);
			for (const filename of filenames) {
				FSHelpers.copyRecursive(
					FS,
					joinPaths(fromPath, filename),
					joinPaths(toPath, filename)
				);
			}
		} else {
			FS.writeFile(toPath, FS.readFile(fromPath));
		}
	}
}
