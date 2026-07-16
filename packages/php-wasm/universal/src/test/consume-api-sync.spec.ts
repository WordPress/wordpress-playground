import { build } from 'esbuild';
import { MessageChannel, Worker } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';
import { consumeAPISync, exposeAPI, exposeSyncAPI } from '../lib/api';

/**
 * These tests pin down the trap behind
 * https://github.com/WordPress/wordpress-playground/issues/3783.
 *
 * The Playground CLI handed a spawned PHP worker its parent's file lock manager
 * *proxy* where a MessagePort was expected. Comlink serialized the proxy onto a
 * port backed by an asynchronous `expose()`, and `consumeAPISync()` accepted it
 * without complaint — because a Comlink proxy answers every property access
 * with a proxied function, it duck-types as an endpoint.
 *
 * The child therefore appeared to boot correctly and only failed on the first
 * synchronous call, five seconds later, on another thread. `consumeAPISync()`
 * must reject the bad endpoint at the point of the mistake instead.
 */
describe('consumeAPISync() endpoint validation', () => {
	it('accepts a real MessagePort', async () => {
		const { port1, port2 } = new MessageChannel();
		await exposeSyncAPI({ ping: () => 'pong' }, port1);

		await expect(consumeAPISync(port2)).resolves.toBeDefined();

		port1.close();
		port2.close();
	});

	it('rejects a Comlink proxy passed in place of a MessagePort', async () => {
		const { port1, port2 } = new MessageChannel();
		await exposeSyncAPI({ ping: () => 'pong' }, port1);
		const proxy = await consumeAPISync<{ ping: () => string }>(port2);

		// This is exactly what the CLI's spawn path used to do. Before the
		// guard it resolved, and every later call timed out after 5 seconds.
		await expect(consumeAPISync(proxy as any)).rejects.toThrow(
			/expects a MessagePort but received a Comlink proxy/
		);

		port1.close();
		port2.close();
	});

	it.each([
		['null', null],
		['undefined', undefined],
		['a plain object', {}],
	])('rejects %s', async (_label, value) => {
		await expect(consumeAPISync(value as any)).rejects.toThrow(
			/expects a MessagePort/
		);
	});

	it('does not identify an arbitrary function as a Comlink proxy', async () => {
		await expect(consumeAPISync((() => undefined) as any)).rejects.toThrow(
			'consumeAPISync() expects a MessagePort but received function.'
		);
	});
});

describe('MessagePort transfer handling', () => {
	it('transfers nested MessagePorts from an exposed API to a consumer worker', async () => {
		const apiChannel = new MessageChannel();
		const phpChannel = new MessageChannel();
		const fileLockManagerChannel = new MessageChannel();
		const childWorkerServiceChannel = new MessageChannel();
		const consumerWorker = await createMessagePortConsumerWorker();
		const [setReady] = exposeAPI(
			{
				createChildWorker: () => ({
					phpPort: phpChannel.port1,
					fileLockManagerPort: fileLockManagerChannel.port1,
					workerConfig: {
						processId: 123,
						childWorkerServicePort: childWorkerServiceChannel.port1,
					},
				}),
			},
			undefined,
			apiChannel.port1
		);
		setReady();
		const messagesFromConsumerWorker = Promise.all([
			new Promise((resolve) => phpChannel.port2.once('message', resolve)),
			new Promise((resolve) =>
				fileLockManagerChannel.port2.once('message', resolve)
			),
			new Promise((resolve) =>
				childWorkerServiceChannel.port2.once('message', resolve)
			),
		]);
		const consumerWorkerError =
			rejectWhenConsumerWorkerFails(consumerWorker);

		try {
			consumerWorker.postMessage({ apiPort: apiChannel.port2 }, [
				apiChannel.port2,
			]);
			await expect(
				Promise.race([messagesFromConsumerWorker, consumerWorkerError])
			).resolves.toEqual([
				'php port',
				'file lock manager port',
				'child worker service port for process 123',
			]);
		} finally {
			apiChannel.port1.close();
			phpChannel.port2.close();
			fileLockManagerChannel.port2.close();
			childWorkerServiceChannel.port2.close();
			await consumerWorker.terminate();
		}
	});
});

async function createMessagePortConsumerWorker(): Promise<Worker> {
	const workerBuild = await build({
		bundle: true,
		format: 'esm',
		platform: 'node',
		target: 'node22',
		write: false,
		stdin: {
			loader: 'js',
			resolveDir: import.meta.dirname,
			sourcefile: 'message-port-consumer.worker.mjs',
			contents: `
		import { parentPort } from 'node:worker_threads';
		import { consumeAPI } from '../lib/api.ts';

		parentPort.once('message', async function consumeApi({ apiPort }) {
			try {
				const api = consumeAPI(apiPort);
				const child = await api.createChildWorker();
				child.phpPort.postMessage('php port');
				child.fileLockManagerPort.postMessage(
					'file lock manager port'
				);
				child.workerConfig.childWorkerServicePort.postMessage(
					'child worker service port for process ' +
						child.workerConfig.processId
				);
				child.phpPort.close();
				child.fileLockManagerPort.close();
				child.workerConfig.childWorkerServicePort.close();
			} catch (error) {
				parentPort.postMessage({
					type: 'error',
					message: error instanceof Error ? error.stack : String(error),
				});
			}
		});
			`,
		},
	});
	const workerSource = workerBuild.outputFiles[0].text;
	return new Worker(
		new URL(`data:text/javascript,${encodeURIComponent(workerSource)}`)
	);
}

function rejectWhenConsumerWorkerFails(worker: Worker): Promise<never> {
	return new Promise<never>((_resolve, reject) => {
		worker.once('error', reject);
		worker.on('message', function rejectReportedWorkerError(message) {
			if (message?.type === 'error') {
				reject(new Error(message.message));
			}
		});
	});
}
