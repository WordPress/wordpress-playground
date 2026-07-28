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

	const opfsPath =
		device.type === 'opfs'
			? device.path
			: getEmbeddedSiteOpfsPath(device.storageKey);
	return opfsPathToDirectoryHandle(opfsPath);
}

export async function opfsPathToDirectoryHandle(
	opfsPath: string
): Promise<FileSystemDirectoryHandle> {
	const parts = opfsPath.split('/').filter((p) => p.length > 0);
	let handle = await navigator.storage.getDirectory();
	for (const part of parts) {
		handle = await handle.getDirectoryHandle(part, { create: true });
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
