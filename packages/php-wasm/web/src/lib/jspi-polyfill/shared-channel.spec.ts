import { Worker } from 'worker_threads';
import {
	createSharedChannel,
	readRequest,
	sendResponseToWorker,
	waitForRequestAsync,
	HEADER_SIZE,
	DEFAULT_DATA_SIZE,
	REQUEST_SLEEP,
} from './shared-channel';

describe('createSharedChannel', () => {
	it('creates a channel with default data size', () => {
		const channel = createSharedChannel();
		expect(channel.sab.byteLength).toBe(HEADER_SIZE + DEFAULT_DATA_SIZE);
		expect(channel.int32View.length).toBe(HEADER_SIZE / 4);
		expect(channel.dataView.byteLength).toBe(DEFAULT_DATA_SIZE);
	});

	it('creates a channel with custom data size', () => {
		const channel = createSharedChannel(256);
		expect(channel.sab.byteLength).toBe(HEADER_SIZE + 256);
		expect(channel.dataView.byteLength).toBe(256);
	});

	it('initializes all header fields to zero', () => {
		const channel = createSharedChannel(64);
		for (let i = 0; i < channel.int32View.length; i++) {
			expect(Atomics.load(channel.int32View, i)).toBe(0);
		}
	});
});

describe('readRequest', () => {
	it('reads request type and params from the channel', () => {
		const channel = createSharedChannel(64);
		// Simulate a request written by the worker.
		Atomics.store(channel.int32View, 1, REQUEST_SLEEP);
		Atomics.store(channel.int32View, 4, 100);
		Atomics.store(channel.int32View, 5, 200);
		Atomics.store(channel.int32View, 6, 300);
		Atomics.store(channel.int32View, 7, 400);
		Atomics.store(channel.int32View, 8, 0);

		const request = readRequest(channel);
		expect(request.requestType).toBe(REQUEST_SLEEP);
		expect(request.params).toEqual([100, 200, 300, 400]);
	});

	it('reads only the meaningful data bytes using requestDataLength', () => {
		const channel = createSharedChannel(64);
		channel.dataView.set([10, 20, 30, 40, 50]);
		// Set requestDataLength to 3 — only first 3 bytes matter.
		Atomics.store(channel.int32View, 8, 3);

		const request = readRequest(channel);
		expect(request.data.length).toBe(3);
		expect(request.data[0]).toBe(10);
		expect(request.data[1]).toBe(20);
		expect(request.data[2]).toBe(30);
	});

	it('returns empty data when requestDataLength is zero', () => {
		const channel = createSharedChannel(64);
		channel.dataView.set([10, 20, 30]);
		Atomics.store(channel.int32View, 8, 0);

		const request = readRequest(channel);
		expect(request.data.length).toBe(0);
	});

	it('returns a snapshot (copy) of the data region', () => {
		const channel = createSharedChannel(64);
		channel.dataView.set([1, 2, 3]);
		Atomics.store(channel.int32View, 8, 3);

		const request = readRequest(channel);
		// Mutate the original.
		channel.dataView[0] = 99;
		// The snapshot should be unchanged.
		expect(request.data[0]).toBe(1);
	});
});

describe('sendResponseToWorker', () => {
	it('writes error code and sets status to response', () => {
		const channel = createSharedChannel(64);
		// Set status to request first (as the worker would).
		Atomics.store(channel.int32View, 0, 1);

		sendResponseToWorker(channel, 42);

		expect(Atomics.load(channel.int32View, 0)).toBe(2);
		expect(Atomics.load(channel.int32View, 2)).toBe(42);
		expect(Atomics.load(channel.int32View, 3)).toBe(0);
	});

	it('writes response data bytes', () => {
		const channel = createSharedChannel(64);
		Atomics.store(channel.int32View, 0, 1);

		const data = new Uint8Array([10, 20, 30]);
		sendResponseToWorker(channel, 0, data);

		expect(Atomics.load(channel.int32View, 2)).toBe(0);
		expect(Atomics.load(channel.int32View, 3)).toBe(3);
		expect(channel.dataView[0]).toBe(10);
		expect(channel.dataView[1]).toBe(20);
		expect(channel.dataView[2]).toBe(30);
	});

	it('handles empty data bytes', () => {
		const channel = createSharedChannel(64);
		sendResponseToWorker(channel, 0, new Uint8Array(0));
		expect(Atomics.load(channel.int32View, 3)).toBe(0);
	});
});

describe('waitForRequestAsync', () => {
	it('fires callback when status changes to request', async () => {
		const channel = createSharedChannel(64);
		const received: number[] = [];

		const { cancel } = waitForRequestAsync(channel, () => {
			received.push(Atomics.load(channel.int32View, 1));
			// Simulate handler: send response and reset.
			sendResponseToWorker(channel, 0);
			Atomics.store(channel.int32View, 0, 0);
		});

		// Simulate a worker posting a request.
		Atomics.store(channel.int32View, 1, REQUEST_SLEEP);
		Atomics.store(channel.int32View, 0, 1);
		Atomics.notify(channel.int32View, 0);

		// Give the async listener time to fire.
		await sleep(50);

		expect(received).toEqual([REQUEST_SLEEP]);
		cancel();
	});

	it('handles multiple sequential requests', async () => {
		const channel = createSharedChannel(64);
		let count = 0;

		const { cancel } = waitForRequestAsync(channel, () => {
			count++;
			sendResponseToWorker(channel, 0);
			Atomics.store(channel.int32View, 0, 0);
		});

		for (let i = 0; i < 3; i++) {
			Atomics.store(channel.int32View, 1, REQUEST_SLEEP);
			Atomics.store(channel.int32View, 0, 1);
			Atomics.notify(channel.int32View, 0);
			await sleep(50);
		}

		expect(count).toBe(3);
		cancel();
	});

	it('stops firing after cancel', async () => {
		const channel = createSharedChannel(64);
		let count = 0;

		const { cancel } = waitForRequestAsync(channel, () => {
			count++;
			sendResponseToWorker(channel, 0);
			Atomics.store(channel.int32View, 0, 0);
		});

		Atomics.store(channel.int32View, 1, REQUEST_SLEEP);
		Atomics.store(channel.int32View, 0, 1);
		Atomics.notify(channel.int32View, 0);
		await sleep(50);
		expect(count).toBe(1);

		cancel();

		// After cancel, new requests should not fire.
		Atomics.store(channel.int32View, 1, REQUEST_SLEEP);
		Atomics.store(channel.int32View, 0, 1);
		Atomics.notify(channel.int32View, 0);
		await sleep(50);
		expect(count).toBe(1);
	});
});

describe('full request/response round-trip', () => {
	it('worker sends request, main thread responds', async () => {
		const channel = createSharedChannel(256);

		// Start the main-thread listener.
		const { cancel } = waitForRequestAsync(channel, () => {
			const req = readRequest(channel);
			expect(req.requestType).toBe(REQUEST_SLEEP);
			expect(req.params[0]).toBe(1000);

			const responseData = new Uint8Array([0xde, 0xad]);
			sendResponseToWorker(channel, 0, responseData);
		});

		// Run the worker-side code in a real worker thread
		// so that Atomics.wait() can actually block.
		const result = await runInWorker(channel.sab, {
			requestType: REQUEST_SLEEP,
			params: [1000, 0, 0, 0],
			data: [],
		});

		expect(result.error).toBe(0);
		expect(result.responseLength).toBe(2);
		expect(result.data).toEqual([0xde, 0xad]);

		// After the worker returns, status should be idle.
		expect(Atomics.load(channel.int32View, 0)).toBe(0);

		cancel();
	});

	it('worker sends data bytes, receives error response', async () => {
		const channel = createSharedChannel(256);

		const { cancel } = waitForRequestAsync(channel, () => {
			const req = readRequest(channel);
			// Verify the data sent by the worker.
			expect(req.data[0]).toBe(0xca);
			expect(req.data[1]).toBe(0xfe);
			sendResponseToWorker(channel, 99);
		});

		const result = await runInWorker(channel.sab, {
			requestType: REQUEST_SLEEP,
			params: [0, 0, 0, 0],
			data: [0xca, 0xfe],
		});

		expect(result.error).toBe(99);
		expect(result.responseLength).toBe(0);

		cancel();
	});

	it('handles multiple round-trips in sequence', async () => {
		const channel = createSharedChannel(256);
		let requestCount = 0;

		const { cancel } = waitForRequestAsync(channel, () => {
			requestCount++;
			const req = readRequest(channel);
			const response = new Uint8Array([req.params[0]]);
			sendResponseToWorker(channel, 0, response);
		});

		// Run three sequential round-trips from
		// separate worker invocations.
		for (let i = 1; i <= 3; i++) {
			const result = await runInWorker(channel.sab, {
				requestType: REQUEST_SLEEP,
				params: [i, 0, 0, 0],
				data: [],
			});
			expect(result.error).toBe(0);
			expect(result.data).toEqual([i]);
		}

		expect(requestCount).toBe(3);
		cancel();
	});
});

// --- Test helpers ---

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

interface WorkerRequest {
	requestType: number;
	params: number[];
	data: number[];
}

interface WorkerResult {
	error: number;
	responseLength: number;
	data: number[];
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

			const HEADER_SIZE = 36;
			const sab = workerData.sab;
			const int32View = new Int32Array(sab, 0, HEADER_SIZE / 4);
			const dataView = new Uint8Array(sab, HEADER_SIZE);
			const channel = { sab, int32View, dataView };

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
			if (workerData.data.length > 0) {
				dataView.set(new Uint8Array(workerData.data));
				Atomics.store(
					int32View,
					REQUEST_DATA_LENGTH,
					workerData.data.length
				);
			} else {
				Atomics.store(int32View, REQUEST_DATA_LENGTH, 0);
			}

			// Signal request and block
			Atomics.store(int32View, 0, 1);
			Atomics.notify(int32View, 0);
			Atomics.wait(int32View, 0, 1);

			// Read response
			const error = Atomics.load(int32View, 2);
			const responseLength = Atomics.load(int32View, 3);
			const data = Array.from(
				new Uint8Array(
					sab,
					HEADER_SIZE,
					responseLength
				)
			);

			// Reset to idle
			Atomics.store(int32View, 0, 0);

			parentPort.postMessage({
				error,
				responseLength,
				data
			});
		`;

		const worker = new Worker(workerCode, {
			eval: true,
			workerData: {
				sab,
				requestType: request.requestType,
				params: request.params,
				data: request.data,
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
