import { existsSync } from 'fs';
import path from 'path';
import { createNodeFsMountHandler } from '@php-wasm/node';
import type { PHP } from '@php-wasm/universal';

export interface Mount {
	hostPath: string;
	vfsPath: string;
}

export function parseMountWithDelimiterArguments(mounts: string[]): Mount[] {
	const parsedMounts = [];
	for (const mount of mounts) {
		const mountParts = mount.split(':');
		if (mountParts.length !== 2) {
			throw new Error(`Invalid mount format: ${mount}.
				Expected format: /host/path:/vfs/path.
				If you're path contains a colon, you can use --mount-dir instead.
				Example: --mount-dir /host/path /wordpress/`);
		}
		const [hostPath, vfsPath] = mountParts;
		if (!existsSync(hostPath)) {
			throw new Error(`Host path does not exist: ${hostPath}`);
		}
		parsedMounts.push({ hostPath, vfsPath });
	}
	return parsedMounts;
}

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

export function getMountsFromCliArgs(args: {
	mount?: string[];
	mountDir?: string[];
	mountBeforeInstall?: string[];
	mountDirBeforeInstall?: string[];
}): {
	mount: Mount[];
	mountBeforeInstall: Mount[];
} {
	const mount = [];
	if (args.mount) {
		mount.push(...parseMountWithDelimiterArguments(args.mount));
	}
	if (args.mountDir) {
		mount.push(...parseMountDirArguments(args.mountDir));
	}

	const mountBeforeInstall = [];
	if (args.mountBeforeInstall) {
		mountBeforeInstall.push(
			...parseMountWithDelimiterArguments(args.mountBeforeInstall)
		);
	}
	if (args.mountDirBeforeInstall) {
		mountBeforeInstall.push(
			...parseMountDirArguments(args.mountDirBeforeInstall)
		);
	}

	return {
		mount,
		mountBeforeInstall,
	};
}

export function mountResources(php: PHP, mounts: Mount[]) {
	for (const mount of mounts) {
		php.mkdir(mount.vfsPath);
		php.mount(mount.vfsPath, createNodeFsMountHandler(mount.hostPath));
	}
}
