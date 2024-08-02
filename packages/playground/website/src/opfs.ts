export async function removeDirHandleContents(
	parent: FileSystemDirectoryHandle
) {
	for await (const [name, entry] of parent.entries()) {
		if (entry.kind === 'directory') {
			await removeDirHandleContents(entry as FileSystemDirectoryHandle);
		}
		await parent.removeEntry(name);
	}
}
