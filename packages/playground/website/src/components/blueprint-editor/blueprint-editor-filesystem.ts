import {
	EventedFilesystem,
	type WritableFilesystemBackend,
} from '@wp-playground/storage';

/**
 * A site-scoped editor filesystem whose reads cannot overtake a queued write.
 *
 * An editor can unmount while its last debounced OPFS write is still running.
 * Reusing this wrapper when that storage backend is opened again
 * makes the next read wait instead of returning stale contents. Failed writes
 * remain visible to their caller but do not block later reads or writes forever.
 */
export class BlueprintEditorFilesystem extends EventedFilesystem {
	private writeQueue: Promise<void> = Promise.resolve();

	/** Serializes editor writes in the order in which they were requested. */
	override writeFile(path: string, data: Uint8Array | string): Promise<void> {
		const write = this.writeQueue.then(() => super.writeFile(path, data));
		this.writeQueue = write.catch(() => undefined);
		return write;
	}

	/** Waits for queued editor writes before reading a file. */
	override async read(path: string) {
		await this.writeQueue;
		return super.read(path);
	}
}

// OPFS backends outlive their editor component. Keep one queued wrapper per
// backend so a remount observes any write started by the previous component.
const editorFilesystems = new WeakMap<
	WritableFilesystemBackend,
	BlueprintEditorFilesystem
>();

/** Returns the queued editor wrapper owned by a filesystem backend. */
export function getBlueprintEditorFilesystem(
	backend: WritableFilesystemBackend
): BlueprintEditorFilesystem {
	let filesystem = editorFilesystems.get(backend);
	if (!filesystem) {
		filesystem = new BlueprintEditorFilesystem(backend);
		editorFilesystems.set(backend, filesystem);
	}
	return filesystem;
}
