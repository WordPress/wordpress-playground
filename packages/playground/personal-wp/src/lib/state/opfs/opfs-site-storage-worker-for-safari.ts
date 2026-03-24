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

	const syncAccessHandle = await fileHandle.createSyncAccessHandle();
	try {
		const encodedContent = new TextEncoder().encode(content);
		syncAccessHandle.truncate(0);
		syncAccessHandle.write(encodedContent);
		responsePort.postMessage('done');
	} finally {
		syncAccessHandle.close();
	}
};
