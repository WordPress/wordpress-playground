// eslint-disable-next-line @nx/enforce-module-boundaries
import { FileLockManagerForWindows } from '@php-wasm/node';
import {
	FileLockManagerInMemory,
	FileLockManagerComposite,
	exposeAPI,
	type NodeProcess,
} from '@php-wasm/universal';
import { createRemoteProcessAPIFromFileLockManager } from './file-lock-manager-test-utils';

// Each child process creates its own FileLockManagerInMemory rather
// than sharing one from the main test thread. This is intentional:
// the child process tests verify that FileLockManagerComposite
// effectively locks files across OS processes, where cross-process
// coordination is handled by the native lock manager (Windows LockFileEx).
const fileLockManager = new FileLockManagerComposite({
	nativeLockManager: new FileLockManagerForWindows(),
	wasmLockManager: new FileLockManagerInMemory(),
});
const api = createRemoteProcessAPIFromFileLockManager(fileLockManager);
exposeAPI(api, undefined, process as NodeProcess);

process.on('uncaughtException', (err) => {
	// eslint-disable-next-line no-console
	console.error('There was an uncaught error', err);
});
