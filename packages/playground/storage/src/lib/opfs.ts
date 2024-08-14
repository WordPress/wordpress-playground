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
