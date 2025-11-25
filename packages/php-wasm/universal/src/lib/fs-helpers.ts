import type { Emscripten } from './emscripten-types';
import {
	ErrnoError,
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
	static writeFile(
		FS: Emscripten.RootFS,
		path: string,
		data: string | Uint8Array | Buffer
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
				if (FSHelpers.isDir(FS, fromPath)) {
					FSHelpers.rmdir(FS, fromPath, { recursive: true });
				} else {
					FS.unlink(fromPath);
				}
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
	static rmdir(
		FS: Emscripten.RootFS,
		path: string,
		options: RmDirOptions = { recursive: true }
	) {
		/**
		 * Mount points cannot be removed and will throw a ErrnoError with
		 * the code 10 (EBUSY).
		 * To prevent the recursive option from removing internal files before
		 * failing to remove the mount point, we need to check if the path is a
		 * mount point and throw an error early.
		 *
		 * Because a mountpoint can be a symlink, we should not follow it.
		 * Otherwise, a mounted sylink would point to the symlinked path,
		 * instead of the mountpoint.
		 */
		const mountPoint = FS.lookupPath(path, { follow: false });
		if (mountPoint?.node.mount.mountpoint === path) {
			throw new ErrnoError(10);
		}

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
		if (FS.getPath(FS.lookupPath(path).node) === FS.cwd()) {
			FS.chdir(joinPaths(FS.cwd(), '..'));
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
	static fileExists(FS: Emscripten.RootFS, path: string): boolean {
		try {
			FS.lookupPath(path);
			return true;
		} catch {
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
	static mkdir(FS: Emscripten.RootFS, path: string) {
		FS.mkdirTree(path);
	}

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
		} else if (FS.isLink(fromNode.mode)) {
			FS.symlink(FS.readlink(fromPath), toPath);
		} else {
			FS.writeFile(toPath, FS.readFile(fromPath));
		}
	}
}

// Apply decorators manually until the decorator syntax is supported
// by Node.js. We do this so we can take advantage of Node.js type stripping
// in the meantime.
// TODO: Inline these decorators once Node.js supports it.
FSHelpers.readFileAsText = rethrowFileSystemError('Could not read "{path}"')(
	FSHelpers.readFileAsText
);
FSHelpers.readFileAsBuffer = rethrowFileSystemError('Could not read "{path}"')(
	FSHelpers.readFileAsBuffer
);
FSHelpers.writeFile = rethrowFileSystemError('Could not write to "{path}"')(
	FSHelpers.writeFile
);
FSHelpers.unlink = rethrowFileSystemError('Could not unlink "{path}"')(
	FSHelpers.unlink
);
FSHelpers.rmdir = rethrowFileSystemError('Could not remove directory "{path}"')(
	FSHelpers.rmdir
);
FSHelpers.listFiles = rethrowFileSystemError(
	'Could not list files in "{path}"'
)(FSHelpers.listFiles);
FSHelpers.isDir = rethrowFileSystemError('Could not stat "{path}"')(
	FSHelpers.isDir
);
FSHelpers.isFile = rethrowFileSystemError('Could not stat "{path}"')(
	FSHelpers.isFile
);
FSHelpers.realpath = rethrowFileSystemError('Could not stat "{path}"')(
	FSHelpers.realpath
);
FSHelpers.fileExists = rethrowFileSystemError('Could not stat "{path}"')(
	FSHelpers.fileExists
);
FSHelpers.mkdir = rethrowFileSystemError('Could not create directory "{path}"')(
	FSHelpers.mkdir
);
FSHelpers.copyRecursive = rethrowFileSystemError(
	'Could not copy files from "{path}"'
)(FSHelpers.copyRecursive);
