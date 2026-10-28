import * as module from 'node:module';
import { parentPort, MessageChannel } from 'node:worker_threads';
import {
	consumeAPISync,
	exposeAPI,
	type FileLockManager,
} from '@php-wasm/universal';
import { createFileLockManager } from '../lib/create-file-lock-manager';
import { createRemoteProcessAPIFromFileLockManager } from './file-lock-manager-test-utils';

// Exercise the actual missing-package path, even on machines with working prebuilds.
// registerHooks() is available in the Node 24 versions supported by this package.
(module as any).registerHooks({
	resolve(
		specifier: string,
		context: unknown,
		nextResolve: (specifier: string, context: unknown) => unknown
	) {
		if (specifier === 'fs-ext-extra-prebuilt') {
			throw Object.assign(
				new Error("Cannot find module 'fs-ext-extra-prebuilt'"),
				{
					code: 'MODULE_NOT_FOUND',
				}
			);
		}
		return nextResolve(specifier, context);
	},
});

parentPort!.once('message', async ({ inMemoryPort }) => {
	const shared = await consumeAPISync<FileLockManager>(inMemoryPort);
	const locks = createFileLockManager(shared);
	const channel = new MessageChannel();
	await exposeAPI(
		createRemoteProcessAPIFromFileLockManager(locks),
		null,
		channel.port1
	);
	parentPort!.postMessage({ apiPort: channel.port2 }, [channel.port2]);
});
