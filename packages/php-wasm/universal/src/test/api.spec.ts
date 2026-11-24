import { build } from 'esbuild';
import { MessageChannel, type MessagePort, Worker } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';
import {
	consumeAPISync,
	exposeAPI,
	exposeSyncAPI,
	withTransferables,
} from '../lib/api';

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
		// A Worker can post messages too, but only a port can receive
		// synchronously.
		['a Worker-like object', { postMessage: () => undefined }],
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

describe('withTransferables()', () => {
	// The consumer runs in a real worker: a port only needs transferring when
	// it leaves its thread, so a same-thread channel would not prove anything.
	it('transfers ports nested in results and arguments across threads', async () => {
		const apiChannel = new MessageChannel();
		const resultChannel = new MessageChannel();
		const consumerWorker = await createConsumerWorker();
		let resolveArgumentMessage!: (message: unknown) => void;
		const argumentMessage = new Promise((resolve) => {
			resolveArgumentMessage = resolve;
		});
		const [setReady] = exposeAPI(
			{
				createChild: () =>
					withTransferables(
						{ id: 123, config: { port: resultChannel.port1 } },
						[resultChannel.port1]
					),
				register(config: { transport: { port: MessagePort } }) {
					config.transport.port.once('message', (message) => {
						resolveArgumentMessage(message);
						config.transport.port.close();
					});
				},
			},
			undefined,
			apiChannel.port1
		);
		setReady();
		const resultMessage = new Promise((resolve) =>
			resultChannel.port2.once('message', resolve)
		);
		const consumerWorkerFailed = new Promise<never>((_resolve, reject) => {
			consumerWorker.once('error', reject);
			consumerWorker.once('message', (message) =>
				reject(new Error(message))
			);
		});

		try {
			consumerWorker.postMessage({ apiPort: apiChannel.port2 }, [
				apiChannel.port2,
			]);
			await expect(
				Promise.race([
					Promise.all([resultMessage, argumentMessage]),
					consumerWorkerFailed,
				])
			).resolves.toEqual([
				'port nested in the result of child 123',
				'port nested in an argument',
			]);
		} finally {
			apiChannel.port1.close();
			resultChannel.port2.close();
			await consumerWorker.terminate();
		}
	});
});

/**
 * Bundle the API module into a worker that consumes the API exposed by the
 * test. The worker reports a failure by posting its message to the parent.
 */
async function createConsumerWorker(): Promise<Worker> {
	const workerBuild = await build({
		bundle: true,
		format: 'esm',
		platform: 'node',
		write: false,
		stdin: {
			resolveDir: import.meta.dirname,
			sourcefile: 'api-consumer-worker.ts',
			loader: 'ts',
			contents: `
		import { MessageChannel, parentPort } from 'node:worker_threads';
		import { consumeAPI, withTransferables } from '../lib/api';

		parentPort.once('message', async ({ apiPort }) => {
			try {
				const api = consumeAPI(apiPort);
				const child = await api.createChild();
				child.config.port.postMessage(
					'port nested in the result of child ' + child.id
				);
				child.config.port.close();

				const argumentChannel = new MessageChannel();
				await api.register(
					withTransferables(
						{ transport: { port: argumentChannel.port1 } },
						[argumentChannel.port1]
					)
				);
				argumentChannel.port2.postMessage('port nested in an argument');
				argumentChannel.port2.close();
			} catch (error) {
				parentPort.postMessage(
					error instanceof Error ? error.stack : String(error)
				);
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
