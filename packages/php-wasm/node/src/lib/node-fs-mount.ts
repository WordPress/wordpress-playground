import type { MountHandler } from '@php-wasm/universal';

export function createNodeFsMountHandler(localPath: string): MountHandler {
	return async function (php, FS, vfsMountPoint) {
		/**
		 * DON'T MERGE THIS.
		 * This is a temporary workaround to demonstrate how mounting requires the mount point to be a directory.
		 *
		 * Emscripten requires the mount point to be a directory.
		 * By creating a directory we can even mount a file over it as long as the paths match.
		 * PHP-WASM source: https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/node/asyncify/php_8_0.js#L2679
		 *
		 * When Emscripten attempt to mount a local path into VFS, it looks up the path
		 * and adds the local path as a mount to the VFS Node.
		 * PHP-WASM source: https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/node/asyncify/php_8_0.js#L2700
		 *
		 * For mounting to work, the Node must exist in VFS and be a directory.
		 * If the Node doesn't exist, the mount fails with error 44 (MEMFS.doesNotExistError).
		 * PHP-WASM source: https://github.com/WordPress/wordpress-playground/blob/trunk/packages/php-wasm/node/asyncify/php_8_0.js#L1201
		 */
		try {
			FS.lookupPath(vfsMountPoint);
		} catch (e) {
			// FS.lookupPath will throw an error if the path doesn't exist.
			FS.mkdirTree(vfsMountPoint);
		}
		FS.mount(FS.filesystems['NODEFS'], { root: localPath }, vfsMountPoint);
		return () => {
			// TODO: Delete the mount point if was created during the mount.
			FS!.unmount(vfsMountPoint);
		};
	};
}
