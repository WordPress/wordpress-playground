import { exposeAPI, exposeSyncAPI } from '@php-wasm/universal';
import { jspi } from 'wasm-feature-detect';
import { parentPort } from 'worker_threads';
import { SyscallsForNode } from '../lib';

parentPort?.on('message', async (port) => {
	console.log('message', port);
	if (!parentPort) {
		throw new Error('parentPort is not available');
	}
	if (await jspi()) {
		exposeAPI(new SyscallsForNode(), null, port);
	} else {
		await exposeSyncAPI(new SyscallsForNode(), port);
	}
	parentPort?.postMessage({ type: 'ready' });
});
