export type HandleDescription = {
	handle: FileSystemDirectoryHandle;
	mountpoint: string;
};
export let directoryHandleDone = false;

export let directoryHandleResolve: (
	value: HandleDescription | null
) => void = () => {};

export const directoryHandle = new Promise<HandleDescription | null>(
	(_directoryHandleResolve, _directoryHandleReject) => {
		directoryHandleResolve = _directoryHandleResolve;
	}
).finally(() => {
	directoryHandleDone = true;
});
