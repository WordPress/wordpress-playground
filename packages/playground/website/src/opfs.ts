export async function removeDirHandleContents(
	parent: FileSystemDirectoryHandle
) {
	for await (const name of parent.keys()) {
		await parent.removeEntry(name, {
			recursive: true,
		});
	}
}
