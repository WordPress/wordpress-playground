import { Worker } from 'worker_threads';
import { createSharedChannel, HEADER_SIZE } from './shared-channel';
import { startMainThreadHandler } from './main-thread-handler';

describe('startMainThreadHandler', () => {
	it('handles REQUEST_SLEEP by waiting the specified ms', async () => {
		const channel = createSharedChannel(64);
		const { cancel } = startMainThreadHandler(channel);

		const sleepMs = 50;
		const start = Date.now();
		const result = await runInWorker(channel.sab, {
			requestType: 1, // REQUEST_SLEEP
			params: [sleepMs, 0, 0, 0],
		});
		const elapsed = Date.now() - start;

		expect(result.error).toBe(0);
		expect(elapsed).toBeGreaterThanOrEqual(sleepMs - 30);
		expect(elapsed).toBeLessThan(sleepMs + 100);

		cancel();
	});

	it('responds with error for unknown request type', async () => {
		const channel = createSharedChannel(64);
		const { cancel } = startMainThreadHandler(channel);

		const result = await runInWorker(channel.sab, {
			requestType: 999,
			params: [0, 0, 0, 0],
		});

		expect(result.error).toBe(1);

		cancel();
	});

	it('handles multiple sequential sleep requests', async () => {
		const channel = createSharedChannel(64);
		const { cancel } = startMainThreadHandler(channel);

		for (let i = 0; i < 3; i++) {
			const result = await runInWorker(channel.sab, {
				requestType: 1, // REQUEST_SLEEP
				params: [10, 0, 0, 0],
			});
			expect(result.error).toBe(0);
		}

		cancel();
	});
});

// --- Test helpers ---

interface WorkerRequest {
	requestType: number;
	params: number[];
}

interface WorkerResult {
	error: number;
	responseLength: number;
}

/**
 * Runs sendRequestFromWorker in a real worker_threads
 * Worker so that Atomics.wait() can block without
 * deadlocking the main thread.
 */
function runInWorker(
	sab: SharedArrayBuffer,
	request: WorkerRequest
): Promise<WorkerResult> {
	return new Promise((resolve, reject) => {
		const workerCode = `
			const { parentPort, workerData } = require('worker_threads');

			const HEADER_SIZE = ${HEADER_SIZE};
			const sab = workerData.sab;
			const int32View = new Int32Array(sab, 0, HEADER_SIZE / 4);
			const dataView = new Uint8Array(sab, HEADER_SIZE);

			const PARAM_INDICES = [4, 5, 6, 7];
			const REQUEST_DATA_LENGTH = 8;

			// Write request
			Atomics.store(int32View, 1, workerData.requestType);
			for (let i = 0; i < PARAM_INDICES.length; i++) {
				Atomics.store(
					int32View,
					PARAM_INDICES[i],
					workerData.params[i] || 0
				);
			}
			Atomics.store(int32View, REQUEST_DATA_LENGTH, 0);

			// Signal request and block
			Atomics.store(int32View, 0, 1);
			Atomics.notify(int32View, 0);
			Atomics.wait(int32View, 0, 1);

			// Read response
			const error = Atomics.load(int32View, 2);
			const responseLength = Atomics.load(int32View, 3);

			// Reset to idle
			Atomics.store(int32View, 0, 0);

			parentPort.postMessage({ error, responseLength });
		`;

		const worker = new Worker(workerCode, {
			eval: true,
			workerData: {
				sab,
				requestType: request.requestType,
				params: request.params,
			},
		});

		worker.on('message', (msg: WorkerResult) => {
			worker.terminate();
			resolve(msg);
		});

		worker.on('error', (err) => {
			worker.terminate();
			reject(err);
		});
	});
}
