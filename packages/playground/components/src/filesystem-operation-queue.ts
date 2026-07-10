import type { AsyncWritableFilesystem } from '@wp-playground/storage';

const operationQueueByFilesystem = new WeakMap<
	AsyncWritableFilesystem,
	Promise<void>
>();

/**
 * Runs one exclusive filesystem operation after every older coordinated operation.
 *
 * The filesystem API cannot reserve destinations atomically. Callers must keep
 * every availability check and its corresponding mutation inside `operation` so
 * sibling surfaces cannot choose the same absent path and overwrite each other.
 * Object identity defines a filesystem; facades for one backing store must be
 * reused if their operations need to coordinate.
 */
export async function serializeFilesystemOperation<T>(
	filesystem: AsyncWritableFilesystem,
	operation: () => Promise<T>
): Promise<T> {
	const previous =
		operationQueueByFilesystem.get(filesystem) ?? Promise.resolve();
	const current = previous.catch(() => undefined).then(operation);
	const completion = settleOperation(current);
	operationQueueByFilesystem.set(filesystem, completion);

	try {
		return await current;
	} finally {
		if (operationQueueByFilesystem.get(filesystem) === completion) {
			operationQueueByFilesystem.delete(filesystem);
		}
	}
}

/**
 * Waits until every coordinated operation queued for a filesystem has settled.
 * Never await this from inside an operation for the same filesystem: that
 * operation is part of the queue being drained.
 */
export async function drainFilesystemOperations(
	filesystem: AsyncWritableFilesystem
): Promise<void> {
	while (true) {
		const pending = operationQueueByFilesystem.get(filesystem);
		if (!pending) {
			return;
		}
		await pending;
		const latest = operationQueueByFilesystem.get(filesystem);
		if (!latest || latest === pending) {
			return;
		}
	}
}

/** Converts either operation outcome into a fulfilled queue barrier. */
function settleOperation(operation: Promise<unknown>): Promise<void> {
	return operation.then(
		() => undefined,
		() => undefined
	);
}
