import {
	FSHelpers,
	type ErrnoError,
	type MountHandler,
} from '@php-wasm/universal';
import { statSync } from 'fs';
import { basename } from 'path';
import type { Emscripten } from '@php-wasm/universal';

export function mountNODEFSMountPoint(
	FS: Emscripten.RootFS,
	vfsMountPoint: string,
	localPath: string
) {
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
	try {
		FS.lookupPath(vfsMountPoint);
	} catch (e) {
		const err = e as ErrnoError;
		// FS.lookupPath will throw an error with errno 44 if the path doesn't exist.
		if (err.errno !== 44) {
			throw e;
		}
		if (statSync(localPath).isSymbolicLink()) {
			(FS as any).createNode(
				FS.lookupPath(vfsMountPoint, { parent: true }).node,
				basename(localPath),
				110000
			);
		} else if (statSync(localPath).isFile()) {
			FS.writeFile(vfsMountPoint, '');
		} else if (statSync(localPath).isDirectory()) {
			FS.mkdirTree(vfsMountPoint);
		} else {
			throw new Error(
				'Unsupported file type. PHP-wasm supports only symlinks that link to files, directories, or symlinks.'
			);
		}
	}
	FS.mount(FS.filesystems['NODEFS'], { root: localPath }, vfsMountPoint);
}

export function createNodeFsMountHandler(localPath: string): MountHandler {
	return function (php, FS, vfsMountPoint) {
		let unlinkPath: string | undefined;
		if (statSync(localPath).isDirectory()) {
			try {
				FS.lookupPath(vfsMountPoint);
			} catch {
				unlinkPath = vfsMountPoint;
			}
		} else {
			unlinkPath = vfsMountPoint;
		}

		mountNODEFSMountPoint(FS, vfsMountPoint, localPath);
		const lookup = FS.lookupPath(vfsMountPoint);

		return () => {
			FS!.unmount(vfsMountPoint);
			if (unlinkPath) {
				if (FS.isDir(lookup.node.mode)) {
					FS.rmdir(unlinkPath);
				} else {
					FS.unlink(unlinkPath);
				}
			}
		};
	};
}
