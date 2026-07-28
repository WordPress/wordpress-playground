// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type * as pleaseLoadTypes from 'wicg-file-system-access';
import { getEmbeddedSiteOpfsPath } from './embedded-site-opfs-path';

export type MountDevice =
	| {
			type: 'opfs';
			path: string;
	  }
	| {
			type: 'opfs-embedded-site';
			storageKey: string;
	  }
	| {
			type: 'local-fs';
			handle: FileSystemDirectoryHandle;
	  };

export async function directoryHandleFromMountDevice(
	device: MountDevice
): Promise<FileSystemDirectoryHandle> {
	if (device.type === 'local-fs') {
		return device.handle;
	}

	if (device.type === 'opfs-embedded-site') {
		return getEmbeddedSiteOpfsDirectoryHandle(device.storageKey, {
			create: true,
		});
	}

	return opfsPathToDirectoryHandle(device.path);
}

/**
 * Opens the canonical OPFS directory for an embedded site.
 *
 * Mounting code should pass `create: true`. Consumers opening an existing site
 * should pass `create: false` so an unknown storage key does not create an
 * empty site.
 */
export async function getEmbeddedSiteOpfsDirectoryHandle(
	storageKey: string,
	options: { create: boolean }
): Promise<FileSystemDirectoryHandle> {
	return opfsPathToDirectoryHandle(getEmbeddedSiteOpfsPath(storageKey), {
		create: options.create,
	});
}

export async function opfsPathToDirectoryHandle(
	opfsPath: string,
	options: { create?: boolean } = {}
): Promise<FileSystemDirectoryHandle> {
	const parts = opfsPath.split('/').filter((p) => p.length > 0);
	let handle = await navigator.storage.getDirectory();
	for (const part of parts) {
		handle = await handle.getDirectoryHandle(part, {
			create: options.create ?? true,
		});
	}
	return handle;
}

export async function directoryHandleToOpfsPath(
	directoryHandle: FileSystemDirectoryHandle
): Promise<string> {
	const root = await navigator.storage.getDirectory();
	const pathParts = await root.resolve(directoryHandle);
	if (pathParts === null) {
		throw new DOMException(
			'Unable to resolve path of OPFS directory handle.',
			'NotFoundError'
		);
	}
	return '/' + pathParts.join('/');
}

export async function clearContentsFromMountDevice(mountDevice: MountDevice) {
	const parentHandle = await directoryHandleFromMountDevice(mountDevice);
	for await (const name of parentHandle.keys()) {
		await parentHandle.removeEntry(name, {
			recursive: true,
		});
	}
}
