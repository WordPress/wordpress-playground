import { MessageChannel, type MessagePort } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';
import {
	consumeAPI,
	consumeAPISync,
	exposeAPI,
	exposeSyncAPI,
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
	it('naturally transfers a MessagePort returned from an exposed API', async () => {
		const apiChannel = new MessageChannel();
		const returnedChannel = new MessageChannel();
		const [setReady] = exposeAPI(
			{ takePort: () => returnedChannel.port1 },
			undefined,
			apiChannel.port1
		);
		setReady();
		const api = consumeAPI<{ takePort: () => MessagePort }>(
			apiChannel.port2
		);

		const port = await api.takePort();
		const message = new Promise((resolve) =>
			returnedChannel.port2.once('message', resolve)
		);
		port.postMessage('transferred');
		await expect(message).resolves.toBe('transferred');

		apiChannel.port1.close();
		apiChannel.port2.close();
		port.close();
		returnedChannel.port2.close();
	});
});
