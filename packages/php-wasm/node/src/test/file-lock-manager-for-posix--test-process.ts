// eslint-disable-next-line @nx/enforce-module-boundaries
import { FileLockManagerForPosix } from '@php-wasm/node';
import { exposeAPI, type NodeProcess } from '@php-wasm/universal';
import { createRemoteProcessAPIFromFileLockManager } from './file-lock-manager-test-utils';

const fileLockManager = new FileLockManagerForPosix();
const api = createRemoteProcessAPIFromFileLockManager(fileLockManager);
exposeAPI(api, undefined, process as NodeProcess);

process.on('uncaughtException', (err) => {
	// eslint-disable-next-line no-console
	console.error('There was an uncaught error', err);
});
