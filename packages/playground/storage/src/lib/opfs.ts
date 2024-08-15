export async function opfsPathToDirectoryHandle(
	opfsPath: string
): Promise<FileSystemDirectoryHandle> {
	const parts = opfsPath.split('/').filter((p) => p.length > 0);
	let handle = await navigator.storage.getDirectory();
	for (const part of parts) {
		handle = await handle.getDirectoryHandle(part);
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

export async function removeContentsFromOpfsPath(parentOpfsPath: string) {
	const parentHandle = await opfsPathToDirectoryHandle(parentOpfsPath);

	for await (const name of parentHandle.keys()) {
		await parentHandle.removeEntry(name, {
			recursive: true,
		});
	}
}
