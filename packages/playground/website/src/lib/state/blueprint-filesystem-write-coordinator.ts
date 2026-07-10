import {
	drainFilesystemOperations,
	serializeFilesystemOperation,
} from '@wp-playground/components';
import type {
	AsyncWritableFilesystem,
	TraversableFilesystemBackend,
} from '@wp-playground/storage';

type BlueprintFilesystemRegistration = {
	filesystem: AsyncWritableFilesystem;
	flush: () => Promise<boolean>;
};

const blueprintFilesystemRegistrations = new WeakMap<
	object,
	BlueprintFilesystemRegistration
>();

/** Reports that an in-memory Blueprint buffer could not reach its filesystem. */
export class BlueprintFilesystemFlushError extends Error {
	constructor() {
		super('Could not flush Blueprint edits before persistence.');
		this.name = 'BlueprintFilesystemFlushError';
	}
}

/**
 * Registers the editor callback that flushes the current in-memory text buffer.
 *
 * The evented facade and its raw backend both identify the same registration.
 * Persistence usually receives the raw backend from site metadata while editor
 * writes use the facade; keeping both aliases here gives them one queue.
 *
 * The returned cleanup removes only this registration, so a replacement editor
 * cannot be unregistered by an older component's delayed cleanup.
 */
export function registerBlueprintFilesystemFlusher(
	filesystem: AsyncWritableFilesystem,
	flush: () => Promise<boolean>
) {
	const registration = { filesystem, flush };
	const backend = (
		filesystem as AsyncWritableFilesystem & {
			backend?: TraversableFilesystemBackend;
		}
	).backend;
	const identities = backend ? [filesystem, backend] : [filesystem];
	for (const identity of identities) {
		blueprintFilesystemRegistrations.set(identity, registration);
	}
	return () => {
		for (const identity of identities) {
			if (
				blueprintFilesystemRegistrations.get(identity) === registration
			) {
				blueprintFilesystemRegistrations.delete(identity);
			}
		}
	};
}

/** Flushes editor-only text and drains queued writes before persistence starts. */
export async function flushPendingBlueprintFilesystemWrites(
	filesystem: TraversableFilesystemBackend
) {
	const registration = blueprintFilesystemRegistrations.get(filesystem);
	if (!registration) {
		return;
	}
	if (!(await registration.flush())) {
		throw new BlueprintFilesystemFlushError();
	}
	await drainFilesystemOperations(registration.filesystem);
}

/**
 * Runs a bundle snapshot behind every editor operation for the same backend.
 *
 * JavaScript runs the continuation after `flush()` before another input event
 * can enqueue a write. The snapshot is therefore the next queue entry: older
 * writes finish first, and newer writes wait until traversal completes.
 */
export async function runWithBlueprintFilesystemSnapshot<T>(
	filesystem: TraversableFilesystemBackend,
	snapshot: (filesystem: TraversableFilesystemBackend) => Promise<T>
): Promise<T> {
	const registration = blueprintFilesystemRegistrations.get(filesystem);
	if (!registration) {
		return snapshot(filesystem);
	}
	await flushPendingBlueprintFilesystemWrites(filesystem);
	return serializeFilesystemOperation(registration.filesystem, () =>
		snapshot(filesystem)
	);
}
