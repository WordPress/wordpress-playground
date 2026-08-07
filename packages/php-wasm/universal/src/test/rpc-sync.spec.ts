/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { getEventListeners, once } from 'node:events';
import { runInNewContext } from 'node:vm';
import {
	MessageChannel as NodeMessageChannel,
	Worker,
} from 'node:worker_threads';
import {
	RemoteAPIEndpointTerminatedError,
	RPC_PROTOCOL_MARKER,
	RPC_PROTOCOL_VERSION,
	SyncRPCOperationTimeoutError,
	consumeAPI,
	consumeAPISync,
	exposeSyncAPI,
} from '../lib/playground-rpc';
import {
	isArrayBufferValue,
	isReadableStreamValue,
	isSharedArrayBufferValue,
	isUint8ArrayValue,
} from '../lib/rpc';

type SyncFixtureAPI = {
	add(value: number): number;
	echo<T>(value: T): T;
	fail(): never;
	delayed(delay: number): string;
	loseEndpoint(): never;
	terminateThenReturn(): string;
};

describe('synchronous Playground RPC', () => {
	it('handles success, receiver state, values, remote errors, and timeouts', async () => {
		const { worker, port } = await spawnSyncFixture();
		const remote = await consumeAPISync<SyncFixtureAPI>(port, {
			timeoutMs: 50,
		});

		expect(remote.add(5)).toBe(15);
		expect(
			remote.echo({
				big: 9007199254740993n,
				bytes: new Uint8Array([1, 2, 3]),
				map: new Map([['key', 4]]),
			})
		).toEqual({
			big: 9007199254740993n,
			bytes: new Uint8Array([1, 2, 3]),
			map: new Map([['key', 4]]),
		});
		expect(() => remote.fail()).toThrowError(
			expect.objectContaining({
				name: 'RangeError',
				message: 'sync remote failure',
				code: 'SYNC_FAILURE',
			})
		);
		expect(() => remote.delayed(200)).toThrow(SyncRPCOperationTimeoutError);

		await worker.terminate();
	});

	it('observes endpoint loss and enforces a dedicated port', async () => {
		const { worker, port } = await spawnSyncFixture();
		const remote = await consumeAPISync<SyncFixtureAPI>(port, {
			timeoutMs: 100,
		});

		expect(() => consumeAPI(port)).toThrow(/dedicated endpoint/);
		await worker.terminate();
		await new Promise((resolve) => setImmediate(resolve));
		expect(() => remote.add(1)).toThrow(RemoteAPIEndpointTerminatedError);
	});

	it('distinguishes endpoint loss during a blocked call', async () => {
		const { worker, port } = await spawnSyncFixture();
		const remote = await consumeAPISync<SyncFixtureAPI>(port, {
			timeoutMs: 1_000,
		});

		expect(() => remote.loseEndpoint()).toThrow(
			RemoteAPIEndpointTerminatedError
		);
		await worker.terminate();
	});

	it('does not overwrite terminal status with a late method result', async () => {
		const { worker, port } = await spawnSyncFixture();
		const remote = await consumeAPISync<SyncFixtureAPI>(port, {
			timeoutMs: 1_000,
		});

		expect(() => remote.terminateThenReturn()).toThrow(
			RemoteAPIEndpointTerminatedError
		);
		await worker.terminate();
	});

	it('rejects non-port endpoints and unbounded deadlines', async () => {
		const { worker, port } = await spawnSyncFixture();
		await expect(consumeAPISync(worker)).rejects.toThrow(
			/dedicated MessagePort/
		);
		await expect(exposeSyncAPI({}, worker)).rejects.toThrow(
			/dedicated MessagePort/
		);
		await expect(
			consumeAPISync({
				constructor: { name: 'PortImpostor' },
				postMessage() {},
				start() {},
				close() {},
				addEventListener() {},
				removeEventListener() {},
			} as unknown as MessagePort)
		).rejects.toThrow(/dedicated MessagePort/);
		await expect(
			consumeAPISync(port, { timeoutMs: Number.POSITIVE_INFINITY })
		).rejects.toThrow(/positive finite/);
		await expect(
			consumeAPISync(port, { handshakeTimeoutMs: -1 })
		).rejects.toThrow(/positive finite/);
		await expect(
			consumeAPISync(port, { maxResponseBytes: 0 })
		).rejects.toThrow(/positive integer/);

		port.close();
		await worker.terminate();
	});

	it('cleans up a dedicated port after handshake timeout', async () => {
		const channel = new NodeMessageChannel();
		await expect(
			consumeAPISync(channel.port1 as unknown as MessagePort, {
				handshakeTimeoutMs: 10,
			})
		).rejects.toBeInstanceOf(SyncRPCOperationTimeoutError);
		expect(getEventListeners(channel.port1, 'message')).toHaveLength(0);
		channel.port2.close();
	});

	it('ignores malformed protocol errors during the handshake', async () => {
		const channel = new NodeMessageChannel();
		channel.port2.on('message', (hello) => {
			if (hello?.kind !== 'sync-hello') return;
			channel.port2.postMessage({
				protocol: RPC_PROTOCOL_MARKER,
				version: RPC_PROTOCOL_VERSION,
				session: hello.session,
				kind: 'protocol-error',
			});
			channel.port2.postMessage({
				protocol: RPC_PROTOCOL_MARKER,
				version: RPC_PROTOCOL_VERSION,
				session: hello.session,
				kind: 'protocol-error',
				remoteVersion: RPC_PROTOCOL_VERSION + 1,
				message: 42,
			});
			channel.port2.postMessage({
				protocol: RPC_PROTOCOL_MARKER,
				version: RPC_PROTOCOL_VERSION,
				session: hello.session,
				kind: 'sync-hello-ack',
			});
		});
		await consumeAPISync<Record<never, never>>(
			channel.port1 as unknown as MessagePort,
			{ handshakeTimeoutMs: 250 }
		);

		channel.port2.close();
	});

	it('rejects an in-progress handshake immediately when its owner aborts', async () => {
		const channel = new NodeMessageChannel();
		const controller = new AbortController();
		const connecting = consumeAPISync(
			channel.port1 as unknown as MessagePort,
			{
				signal: controller.signal,
				handshakeTimeoutMs: 1_000,
			}
		);
		controller.abort(new Error('sync owner stopped'));
		await expect(connecting).rejects.toMatchObject({
			name: 'RemoteAPIEndpointTerminatedError',
			reason: 'aborted',
		});
		expect(getEventListeners(channel.port1, 'message')).toHaveLength(0);
		channel.port2.close();
	});

	it('ignores malformed undersized shared buffers and remains usable', async () => {
		const channel = new NodeMessageChannel();
		await exposeSyncAPI(
			{
				ping() {
					return 'pong';
				},
			},
			channel.port1 as unknown as MessagePort
		);
		const session = 'malformed-sync-session';
		channel.port2.postMessage({
			protocol: RPC_PROTOCOL_MARKER,
			version: RPC_PROTOCOL_VERSION,
			session,
			kind: 'sync-hello',
		});
		await once(channel.port2, 'message');

		channel.port2.postMessage({
			protocol: RPC_PROTOCOL_MARKER,
			version: RPC_PROTOCOL_VERSION,
			session,
			kind: 'sync-request',
			requestId: 'malformed',
			path: ['ping'],
			payload: '{"value":[]}',
			sharedBuffer: new SharedArrayBuffer(4),
		});

		const sharedBuffer = new SharedArrayBuffer(128);
		channel.port2.postMessage({
			protocol: RPC_PROTOCOL_MARKER,
			version: RPC_PROTOCOL_VERSION,
			session,
			kind: 'sync-request',
			requestId: 'valid-after-malformed',
			path: ['ping'],
			payload: '{"value":[]}',
			sharedBuffer,
		});
		await waitForAtomicStatus(sharedBuffer);
		const status = new Int32Array(sharedBuffer, 0, 2);
		expect(Atomics.load(status, 0)).toBe(1);
		const responseLength = Atomics.load(status, 1);
		const response = new TextDecoder().decode(
			new Uint8Array(sharedBuffer, 8, responseLength)
		);
		expect(JSON.parse(response)).toEqual({ value: 'pong' });

		channel.port2.postMessage({
			protocol: RPC_PROTOCOL_MARKER,
			version: RPC_PROTOCOL_VERSION,
			session,
			kind: 'release',
		});
		channel.port2.close();
	});

	it('recognizes genuine binary values from another JavaScript realm', () => {
		const crossRealm = runInNewContext(`({
			arrayBuffer: new ArrayBuffer(16),
			sharedArrayBuffer: new SharedArrayBuffer(16),
			bytes: new Uint8Array([1, 2, 3])
		})`);
		expect(crossRealm.arrayBuffer).not.toBeInstanceOf(ArrayBuffer);
		expect(crossRealm.sharedArrayBuffer).not.toBeInstanceOf(
			SharedArrayBuffer
		);
		expect(crossRealm.bytes).not.toBeInstanceOf(Uint8Array);
		expect(isArrayBufferValue(crossRealm.arrayBuffer)).toBe(true);
		expect(isSharedArrayBufferValue(crossRealm.sharedArrayBuffer)).toBe(
			true
		);
		expect(isUint8ArrayValue(crossRealm.bytes)).toBe(true);
		expect(isReadableStreamValue(new ReadableStream())).toBe(true);
		expect(
			isSharedArrayBufferValue({
				byteLength: 16,
				[Symbol.toStringTag]: 'SharedArrayBuffer',
			})
		).toBe(false);
		expect(
			isArrayBufferValue({
				byteLength: 16,
				[Symbol.toStringTag]: 'ArrayBuffer',
			})
		).toBe(false);
		expect(
			isUint8ArrayValue({
				[Symbol.toStringTag]: 'Uint8Array',
			})
		).toBe(false);
		expect(isReadableStreamValue({ locked: false })).toBe(false);
	});
});

async function waitForAtomicStatus(sharedBuffer: SharedArrayBuffer) {
	const status = new Int32Array(sharedBuffer, 0, 2);
	for (let attempt = 0; attempt < 100; attempt++) {
		if (Atomics.load(status, 0) !== 0) return;
		await new Promise((resolve) => setImmediate(resolve));
	}
	throw new Error('The synchronous fixture did not write a response.');
}

async function spawnSyncFixture(): Promise<{
	worker: Worker;
	port: MessagePort;
}> {
	const channel = new NodeMessageChannel();
	const worker = new Worker(
		new URL('./fixtures/rpc-sync-worker.mjs', import.meta.url),
		{
			workerData: {
				moduleUrl: new URL(
					'../../../../../dist/test-fixtures/php-wasm-universal/rpc-sync-runtime.js',
					import.meta.url
				).href,
				port: channel.port1,
			},
			transferList: [channel.port1],
		}
	);
	await once(worker, 'message');
	return {
		worker,
		port: channel.port2 as unknown as MessagePort,
	};
}
