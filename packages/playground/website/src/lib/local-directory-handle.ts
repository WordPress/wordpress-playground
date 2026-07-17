/**
 * Helpers for picker-granted FileSystemDirectoryHandle objects.
 *
 * Handles restored from IndexedDB can outlive both the browser's permission
 * grant and the directory itself, so every consumer needs the same three
 * capabilities: open the picker with one shared identity, ask the browser for
 * permission again, and classify whether a stored handle is still usable.
 */

/**
 * One picker id for every local-folder flow so the browser reopens the picker
 * in the user's last-used folder no matter which UI surface asked.
 */
export const LOCAL_FOLDER_PICKER_ID = 'playground-local-folder';

export type DirectoryHandleReadiness =
	| 'ready'
	| 'needs-permission'
	| 'missing-directory';

/**
 * The File System Access permission and iteration methods are Chromium-only,
 * so they stay optional. Browsers without them (or non-window realms) grant
 * access implicitly by having produced the handle at all.
 */
type PermissionCapableDirectoryHandle = FileSystemDirectoryHandle & {
	queryPermission?: (descriptor: {
		mode: 'readwrite';
	}) => Promise<PermissionState>;
	requestPermission?: (descriptor: {
		mode: 'readwrite';
	}) => Promise<PermissionState>;
	keys?: () => AsyncIterableIterator<string>;
};

export async function showLocalFolderPicker(): Promise<FileSystemDirectoryHandle> {
	const picker = (
		window as Window & {
			showDirectoryPicker?: (options: {
				id: string;
				mode: 'readwrite';
			}) => Promise<FileSystemDirectoryHandle>;
		}
	).showDirectoryPicker;
	if (typeof picker !== 'function') {
		throw new Error('Local folders are not supported by this browser.');
	}
	return await picker({
		id: LOCAL_FOLDER_PICKER_ID,
		mode: 'readwrite',
	});
}

/**
 * Classifies whether a stored handle can be mounted right now.
 *
 * A permission query alone cannot detect a folder that was moved or deleted
 * after the grant survived, so readiness also requires one successful read.
 */
export async function probeDirectoryHandle(
	directoryHandle: FileSystemDirectoryHandle
): Promise<DirectoryHandleReadiness> {
	if ((await queryDirectoryHandlePermission(directoryHandle)) !== 'granted') {
		return 'needs-permission';
	}
	try {
		await readFirstDirectoryEntry(directoryHandle);
		return 'ready';
	} catch (error) {
		return (error as DOMException | undefined)?.name === 'NotFoundError'
			? 'missing-directory'
			: 'needs-permission';
	}
}

export async function queryDirectoryHandlePermission(
	directoryHandle: FileSystemDirectoryHandle
): Promise<PermissionState> {
	const handle = directoryHandle as PermissionCapableDirectoryHandle;
	if (!handle.queryPermission) {
		return 'granted';
	}
	return await handle.queryPermission({ mode: 'readwrite' });
}

/**
 * Must run inside a user gesture, or Chromium auto-denies the request.
 */
export async function requestDirectoryHandlePermission(
	directoryHandle: FileSystemDirectoryHandle
): Promise<PermissionState> {
	const handle = directoryHandle as PermissionCapableDirectoryHandle;
	if (!handle.requestPermission) {
		return 'granted';
	}
	return await handle.requestPermission({ mode: 'readwrite' });
}

/**
 * Reports whether the folder already contains anything, so save flows can ask
 * before writing a WordPress tree next to existing files. Reads one entry
 * rather than listing the folder, which can be arbitrarily large.
 */
export async function directoryHandleHasEntries(
	directoryHandle: FileSystemDirectoryHandle
): Promise<boolean> {
	return (await readFirstDirectoryEntry(directoryHandle)) !== undefined;
}

async function readFirstDirectoryEntry(
	directoryHandle: FileSystemDirectoryHandle
): Promise<string | undefined> {
	const iterator = (
		directoryHandle as PermissionCapableDirectoryHandle
	).keys?.();
	if (!iterator) {
		return undefined;
	}
	const first = await iterator.next();
	return first.done ? undefined : first.value;
}
