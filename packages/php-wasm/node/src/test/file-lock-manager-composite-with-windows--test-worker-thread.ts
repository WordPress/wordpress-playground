// eslint-disable-next-line @nx/enforce-module-boundaries
import { FileLockManagerForWindows } from '@php-wasm/node';
import {
	FileLockManagerComposite,
	consumeAPISync,
	exposeAPI,
	type FileLockManager,
} from '@php-wasm/universal';
import { parentPort, MessageChannel } from 'worker_threads';
import { createRemoteProcessAPIFromFileLockManager } from './file-lock-manager-test-utils';

// Wait for the main thread to send the shared in-memory manager port.
// The main thread creates a FileLockManagerInMemory and exposes it via
// exposeSyncAPI. We receive the other end of that MessageChannel here,
// wrap it with consumeAPISync to get a synchronous proxy, and use it
// as the wasm lock manager in our composite.
parentPort!.once('message', async (msg) => {
	const inMemoryManager = await consumeAPISync<FileLockManager>(
		msg.inMemoryPort
	);
	const composite = new FileLockManagerComposite({
		nativeLockManager: new FileLockManagerForWindows(),
		wasmLockManager: inMemoryManager,
	});
	const api = createRemoteProcessAPIFromFileLockManager(composite);

	// Expose the composite API on a new MessageChannel and send it
	// back to the main thread.
	const apiChannel = new MessageChannel();
	// @ts-ignore
	exposeAPI(api, null, apiChannel.port1);
	parentPort!.postMessage({ apiPort: apiChannel.port2 }, [apiChannel.port2]);
});
