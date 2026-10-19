import { afterEach, expect, it, vi } from 'vitest';
import { Worker, MessageChannel } from 'node:worker_threads';
import {
	FileLockManagerInMemory,
	consumeAPI,
	exposeSyncAPI,
	releaseApiProxy,
	type RemoteAPI,
} from '@php-wasm/universal';
import type { TestWorkerAPI } from './file-lock-manager-test-utils';

let worker: Worker | undefined;
let api: RemoteAPI<TestWorkerAPI> | undefined;
let channel: MessageChannel | undefined;
afterEach(async () => {
	api?.[releaseApiProxy]();
	await worker?.terminate();
	channel?.port1.close();
	channel?.port2.close();
	vi.restoreAllMocks();
});

it.each(['whole-file', 'byte-range'])(
	'waits for a %s lock without blocking its shared manager',
	async (kind) => {
		const shared = new FileLockManagerInMemory();
		channel = new MessageChannel();
		await exposeSyncAPI(shared, channel.port1);
		worker = new Worker(
			new URL(
				'./file-lock-manager-fallback--test-worker-thread.ts',
				import.meta.url
			),
			{
				execArgv: [
					'--import',
					'./packages/meta/src/node-es-module-loader/register.mts',
				],
			}
		);
		const ready = new Promise<any>((resolve, reject) => {
			worker!.once('message', resolve);
			worker!.once('error', reject);
		});
		worker.postMessage({ inMemoryPort: channel.port2 }, [channel.port2]);
		api = await consumeAPI<TestWorkerAPI>((await ready).apiPort);
		const whole = {
			type: 'exclusive' as const,
			pid: 1,
			fd: 1,
			waitForLock: false,
		};
		const range = {
			type: 'exclusive' as const,
			pid: 1,
			fd: 1,
			start: 0n,
			end: 1n,
		};
		const spy = vi.spyOn(
			shared,
			kind === 'whole-file' ? 'lockWholeFile' : 'lockFileByteRange'
		);
		if (kind === 'whole-file') {
			shared.lockWholeFile('/file', whole);
		} else {
			shared.lockFileByteRange('/file', range);
		}
		spy.mockClear();
		let completed = false;
		const waiting = (
			kind === 'whole-file'
				? api.lockWholeFile('/file', {
						...whole,
						pid: 2,
						fd: 2,
						waitForLock: true,
					})
				: api.lockFileByteRange(
						'/file',
						{ ...range, start: 0, end: 1, pid: 2, fd: 2 },
						true
					)
		).then((result) => {
			completed = true;
			return result;
		});
		await vi.waitFor(() => expect(spy).toHaveBeenCalled());
		expect(completed).toBe(false);
		shared.releaseLocksForProcess(1);
		await expect(waiting).resolves.toBe(true);
	},
	15_000
);
