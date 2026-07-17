/**
 * One-shot handoff of a picker-granted directory handle into the save surface.
 *
 * The OS picker must open inside the user's click gesture, e.g. in a row menu,
 * but the confirmation UI lives in the save pane. Handles are not serializable,
 * so Redux cannot carry them; the pane consumes the handle on its next mount.
 */
let pendingPickedFolder: FileSystemDirectoryHandle | null = null;

export function setPendingPickedFolder(handle: FileSystemDirectoryHandle) {
	pendingPickedFolder = handle;
}

export function consumePendingPickedFolder(): FileSystemDirectoryHandle | null {
	const handle = pendingPickedFolder;
	pendingPickedFolder = null;
	return handle;
}
