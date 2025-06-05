import { existsSync } from 'fs';
import path from 'path';
import { createNodeFsMountHandler } from '@php-wasm/node';
import type { PHP } from '@php-wasm/universal';

export interface Mount {
	hostPath: string;
	vfsPath: string;
}

/**
 * Parse an array of mount argument strings where the host path and VFS path
 * are separated by a colon.
 * 
 * Example:
 *     parseMountWithDelimiterArguments( [ '/host/path:/vfs/path', '/host/path:/vfs/path' ] )
 *     // returns:
 *     [ 
 *         { hostPath: '/host/path', vfsPath: '/vfs/path' },
 *         { hostPath: '/host/path', vfsPath: '/vfs/path' }
 *     ]
 *
 * @param mounts - An array of mount argument strings separated by a colon.
 * @returns An array of Mount objects.
 */
export function parseMountWithDelimiterArguments(mounts: string[]): Mount[] {
	const parsedMounts = [];
	for (const mount of mounts) {
		const mountParts = mount.split(':');
		if (mountParts.length !== 2) {
			throw new Error(`Invalid mount format: ${mount}.
				Expected format: /host/path:/vfs/path.
				If your path contains a colon, e.g. C:\\myplugin, use the --mount-dir option instead.
				Example: --mount-dir C:\\my-plugin /wordpress/wp-content/plugins/my-plugin`);
		}
		const [hostPath, vfsPath] = mountParts;
		if (!existsSync(hostPath)) {
			throw new Error(`Host path does not exist: ${hostPath}`);
		}
		parsedMounts.push({ hostPath, vfsPath });
	}
	return parsedMounts;
}

/**
 * Parse an array of mount argument strings where each odd array element is a host path
 * and each even element is the VFS path.
 * e.g. [ '/host/path', '/vfs/path', '/host/path2', '/vfs/path2' ]
 *
 * The result will be an array of Mount objects for each host path the
 * following element is it's VFS path.
 * e.g. [
 *   { hostPath: '/host/path', vfsPath: '/vfs/path' },
 *   { hostPath: '/host/path2', vfsPath: '/vfs/path2' }
 * ]
 *
 * @param mounts - An array of paths
 * @returns An array of Mount objects.
 */
export function parseMountDirArguments(mounts: string[]): Mount[] {
	if (mounts.length % 2 !== 0) {
		throw new Error('Invalid mount format. Expected: /host/path /vfs/path');
	}

	const parsedMounts = [];
	for (let i = 0; i < mounts.length; i += 2) {
		const source = mounts[i];
		const vfsPath = mounts[i + 1];
		if (!existsSync(source)) {
			throw new Error(`Host path does not exist: ${source}`);
		}
		parsedMounts.push({
			hostPath: path.resolve(process.cwd(), source),
			vfsPath,
		});
	}
	return parsedMounts;
}

export function mountResources(php: PHP, mounts: Mount[]) {
	for (const mount of mounts) {
		php.mkdir(mount.vfsPath);
		php.mount(mount.vfsPath, createNodeFsMountHandler(mount.hostPath));
	}
}
