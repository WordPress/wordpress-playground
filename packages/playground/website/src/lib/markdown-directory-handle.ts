export let directoryHandleDone = false;

export let directoryHandleResolve: (
	value: FileSystemDirectoryHandle | null
) => void = () => {};

export const directoryHandle = new Promise<FileSystemDirectoryHandle | null>(
	(_directoryHandleResolve, _directoryHandleReject) => {
		directoryHandleResolve = _directoryHandleResolve;
	}
).finally(() => {
	directoryHandleDone = true;
});
