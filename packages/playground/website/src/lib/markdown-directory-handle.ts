export let directoryHandleDone = false;

export let directoryHandleReject: () => void = () => {};

export let directoryHandleResolve: (
	value: FileSystemDirectoryHandle | PromiseLike<FileSystemDirectoryHandle>
) => void = () => {};

export const directoryHandle = new Promise<FileSystemDirectoryHandle>(
	(_directoryHandleResolve, _directoryHandleReject) => {
		directoryHandleResolve = _directoryHandleResolve;
		directoryHandleReject = _directoryHandleReject;
	}
).finally(() => {
	directoryHandleDone = true;
});
