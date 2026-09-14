/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { fork } from 'node:child_process';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import {
	RemoteAPIEndpointTerminatedError,
	consumeAPI,
	releaseApiProxy,
	type NodeProcess,
} from '../lib/playground-rpc';

describe('Playground RPC endpoint adapters', () => {
	it('uses a Node worker_threads Worker directly and observes exit', async () => {
		const moduleUrl = new URL(
			'../../../../../dist/test-fixtures/php-wasm-universal/rpc-sync-runtime.js',
			import.meta.url
		).href;
		const worker = new Worker(
			new URL('./fixtures/rpc-async-worker.mjs', import.meta.url),
			{ workerData: { moduleUrl } }
		);
		await once(worker, 'message');
		const remote = consumeAPI<{
			ping(value: string): Promise<string>;
			never(): Promise<void>;
		}>(worker);

		expect(await remote.ping('worker')).toBe('pong:worker');
		const pending = remote.never();
		await worker.terminate();
		await expect(pending).rejects.toBeInstanceOf(
			RemoteAPIEndpointTerminatedError
		);
		await expect(remote[releaseApiProxy]()).resolves.toBeUndefined();
	});

	it('uses real Node child-process IPC for calls, callbacks, errors, and disconnect', async () => {
		const child = spawnChildFixture();
		await once(child, 'message');
		const remote = consumeAPI<{
			ping(value: string): Promise<string>;
			invoke(
				callback: (value: number) => Promise<number>,
				value: number
			): Promise<number>;
			reflect<T>(value: T): Promise<T>;
			fail(): Promise<never>;
			never(): Promise<never>;
		}>(child as unknown as NodeProcess);

		expect(await remote.ping('child')).toBe('pong:child');
		expect(await remote.invoke(async (value) => value * 3, 4)).toBe(12);
		const structuredValue = {
			integer: 9_007_199_254_740_993n,
			map: new Map<string, number>([['answer', 42]]),
			bytes: new Uint8Array([1, 2, 3]),
		};
		expect(await remote.reflect(structuredValue)).toEqual(structuredValue);
		await expect(remote.fail()).rejects.toMatchObject({
			name: 'RangeError',
			message: 'child failure',
		});
		const pending = remote.never();
		const exited = once(child, 'exit');
		child.disconnect();
		await expect(pending).rejects.toBeInstanceOf(
			RemoteAPIEndpointTerminatedError
		);
		await exited;
	});
});

function spawnChildFixture() {
	const moduleUrl = new URL(
		'../../../../../dist/test-fixtures/php-wasm-universal/rpc-sync-runtime.js',
		import.meta.url
	).href;
	return fork(
		new URL('./fixtures/rpc-child-process.mjs', import.meta.url),
		[moduleUrl],
		{
			serialization: 'advanced',
			stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
		}
	);
}
