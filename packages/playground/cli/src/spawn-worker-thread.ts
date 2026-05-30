import { ProcessIdAllocator } from '@php-wasm/universal';
import { Worker } from 'worker_threads';
import type { MessagePort as NodeMessagePort } from 'worker_threads';

// Inlined worker URLs for static analysis by downstream bundlers.
// These are replaced at build time by the Vite plugin in vite.config.ts.
declare const __WORKER_V1_URL__: string;
declare const __WORKER_V2_URL__: string;

const processIdAllocator = new ProcessIdAllocator();

export type SpawnedWorker = {
	processId: number;
	worker: Worker;
	phpPort: NodeMessagePort;
};

/**
 * A statically analyzable function that spawns a worker thread of a given type.
 *
 * **Important:** This function builds to code that has the worker URL hardcoded
 * inline, e.g. `new Worker(new URL('./worker-thread-v1.js', import.meta.url))`.
 * This allows the downstream consumers to statically analyze the code, recognize
 * it uses workers, create new entrypoints, and rewrite the new Worker() calls.
 *
 */
export function spawnWorkerThread(
	workerType: 'v1' | 'v2',
	{ onExit }: { onExit?: (code: number) => void } = {}
) {
	/*
	 * Built CLI bundles replace these constants with compiled worker URLs.
	 * Source runs do not pass through Vite, so provide the TypeScript worker
	 * paths here instead of forcing worker modules to import the full CLI runner.
	 */
	if (typeof __WORKER_V1_URL__ === 'undefined') {
		// @ts-expect-error
		globalThis['__WORKER_V1_URL__'] = './blueprints-v1/worker-thread-v1.ts';
	}
	if (typeof __WORKER_V2_URL__ === 'undefined') {
		// @ts-expect-error
		globalThis['__WORKER_V2_URL__'] = './blueprints-v2/worker-thread-v2.ts';
	}
	let worker: Worker;
	if (workerType === 'v1') {
		worker = new Worker(new URL(__WORKER_V1_URL__, import.meta.url));
	} else {
		worker = new Worker(new URL(__WORKER_V2_URL__, import.meta.url));
	}

	return new Promise<SpawnedWorker>((resolve, reject) => {
		const processId = processIdAllocator.claim();

		worker.once('message', function (message: any) {
			// Let the worker confirm it has initialized.
			// We could use the 'online' event to detect start of JS execution,
			// but that would miss initialization errors.
			if (message.command === 'worker-script-initialized') {
				resolve({
					processId,
					worker,
					phpPort: message.phpPort,
				});
			}
		});
		worker.once('error', function (e: Error) {
			processIdAllocator.release(processId);

			console.error(e);
			const originalMessage =
				e?.message || (e ? String(e) : 'unknown error');
			const error = new Error(
				`Worker failed to load. Original error: ${originalMessage}`,
				{ cause: e }
			);
			reject(error);
		});
		let spawned = false;
		worker.once('spawn', () => {
			spawned = true;
		});
		worker.once('exit', (code) => {
			processIdAllocator.release(processId);

			if (!spawned) {
				reject(new Error(`Worker exited before spawning: ${code}`));
			}
			onExit?.(code);
		});
	});
}
