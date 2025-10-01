import {
	type Emscripten,
	FSHelpers,
	type MountHandler,
} from '@php-wasm/universal';
import { isParentOf } from '@php-wasm/util';
import { lstatSync } from 'fs';
import { dirname } from 'path';

export function createNodeFsMountHandler(localPath: string): MountHandler {
	return function (php, FS, vfsMountPoint) {
		/**
		 * When Emscripten attempt to mount a local path into VFS, it looks up the path
		 * and adds the local path as a mount to the VFS Node.
		 * PHP-WASM source: https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/node/asyncify/php_8_0.js#L2700
		 *
		 * For mounting to work, the Node must exist in VFS.
		 * If the Node doesn't exist, the mount fails with error 44 (MEMFS.doesNotExistError).
		 * PHP-WASM source: https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/node/asyncify/php_8_0.js#L1201
		 *
		 * Emscripten requires the mount point to be a directory.
		 * To work around this, the PHP-wasm compile removes the directory check.
		 * PHP-WASM source: https://github.com/WordPress/wordpress-playground/blob/5821cee231f452d050fd337b99ad0b26ebda487e/packages/php-wasm/compile/php/Dockerfile#L2148
		 */
		let removeVfsNode = false;
		if (!FSHelpers.fileExists(FS, vfsMountPoint)) {
			const lstat = lstatSync(localPath);
			if (lstat.isFile() || lstat.isSymbolicLink()) {
				FS.mkdirTree(dirname(vfsMountPoint));
				FS.writeFile(vfsMountPoint, '');
			} else if (lstat.isDirectory()) {
				FS.mkdirTree(vfsMountPoint);
			} else {
				throw new Error(
					'Unsupported file type. PHP-wasm supports only symlinks that link to files, directories, or symlinks.'
				);
			}
			removeVfsNode = true;
		}
		let lookup: Emscripten.FS.Lookup | undefined;
		try {
			lookup = FS.lookupPath(vfsMountPoint);
		} catch (e) {
			const error = e as Emscripten.FS.ErrnoError;
			if (error.errno === 44) {
				throw new Error(
					`Unable to access the mount point ${vfsMountPoint} in VFS after attempting to create it.`
				);
			}
			throw e;
		}
		FS.mount(FS.filesystems['NODEFS'], { root: localPath }, vfsMountPoint);
		return () => {
			FS!.unmount(vfsMountPoint);
			if (removeVfsNode) {
				if (FS.isDir(lookup.node.mode)) {
					if (isParentOf(vfsMountPoint, FS.cwd())) {
						throw new Error(
							`Cannot remove the VFS directory "${vfsMountPoint}" on umount cleanup – it is a parent of the CWD "${FS.cwd()}". Change CWD before ` +
								`unmounting or explicitly disable post-unmount node cleanup with createNodeFsMountHandler(path, {cleanupNodesOnUnmount: false}).`
						);
					}
					FS.rmdir(vfsMountPoint);
				} else {
					FS.unlink(vfsMountPoint);
				}
			}
		};
	};
}
