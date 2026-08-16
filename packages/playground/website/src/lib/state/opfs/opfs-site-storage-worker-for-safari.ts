/**
 * This worker module exists to allow writing file content to OPFS from the
 * main browser thread. Today (2024-08-17), Safari only appears to support
 * writing to OPFS via createSyncAccessHandle(), and that is only supported
 * within dedicated workers.
 *
 * This worker exists so non-worker threads can trigger writing to OPFS files.
 */
onmessage = async function (event: MessageEvent) {
	const filePath: string = event.data.path;
	const content: string = event.data.content;
	const responsePort = event.ports[0];

	try {
		const pathParts = filePath.split('/').filter((p) => p.length > 0);

		const fileName = pathParts.pop();
		if (fileName === undefined) {
			throw new Error(`Invalid path: '${filePath}'`);
		}

		let parentDirHandle = await navigator.storage.getDirectory();
		for (const part of pathParts) {
			parentDirHandle = await parentDirHandle.getDirectoryHandle(part);
		}

		const fileHandle = await parentDirHandle.getFileHandle(fileName, {
			create: true,
		});

		const syncAccessHandle =
			await createSyncAccessHandleWithRetry(fileHandle);
		try {
			const encodedContent = new TextEncoder().encode(content);
			syncAccessHandle.truncate(0);
			syncAccessHandle.write(encodedContent);
			responsePort.postMessage('done');
		} finally {
			syncAccessHandle.close();
		}
	} catch (error) {
		responsePort.postMessage({
			type: 'error',
			path: filePath,
			error:
				error instanceof Error
					? {
							name: error.name,
							message: error.message,
							stack: error.stack,
						}
					: error,
		});
	}
};

/**
 * Creates an exclusive OPFS access handle after transient contention clears.
 *
 * The OPFS API may reject `createSyncAccessHandle()` with
 * `NoModificationAllowedError` while another tab or writable stream still
 * holds the file, as observed in Chromium. Same-page metadata writes are
 * serialized by the caller, but those external handles cannot join that
 * in-memory queue. Retrying every 50 milliseconds for at most 20 attempts
 * gives a short-lived handle time to close while remaining well inside the
 * caller's five-second worker timeout.
 *
 * Only access-handle contention is retried. Missing directories, permission
 * failures, and every other error are returned immediately.
 *
 * @param fileHandle OPFS file whose synchronous access handle is required.
 * @returns The exclusive synchronous access handle.
 * @throws The final contention error or any non-retryable error.
 */
async function createSyncAccessHandleWithRetry(
	fileHandle: FileSystemFileHandle
): Promise<FileSystemSyncAccessHandle> {
	const maxAttempts = 20;
	const retryDelayMs = 50;
	for (let attempt = 1; attempt < maxAttempts; attempt++) {
		try {
			return await fileHandle.createSyncAccessHandle();
		} catch (error) {
			if (
				!(error instanceof DOMException) ||
				error.name !== 'NoModificationAllowedError'
			) {
				throw error;
			}
			await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
		}
	}

	return fileHandle.createSyncAccessHandle();
}
