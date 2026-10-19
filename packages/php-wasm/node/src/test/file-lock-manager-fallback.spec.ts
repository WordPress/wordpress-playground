import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Worker, MessageChannel } from 'node:worker_threads';
import {
	closeSync,
	mkdtempSync,
	openSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { joinPaths, toPosixPath } from '@php-wasm/util';
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
let dir: string;
let path: string;
let firstFd: number;
let secondFd: number;
beforeEach(() => {
	dir = mkdtempSync(joinPaths(toPosixPath(tmpdir()), 'php-lock-worker-'));
	path = joinPaths(dir, 'file');
	writeFileSync(path, '');
	firstFd = openSync(path, 'r+');
	secondFd = openSync(path, 'r+');
});
afterEach(async () => {
	api?.[releaseApiProxy]();
	await worker?.terminate();
	channel?.port1.close();
	channel?.port2.close();
	closeSync(firstFd);
	closeSync(secondFd);
	rmSync(dir, { recursive: true, force: true });
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
			fd: firstFd,
			waitForLock: false,
		};
		const range = {
			type: 'exclusive' as const,
			pid: 1,
			fd: firstFd,
			start: 0n,
			end: 1n,
		};
		const spy = vi.spyOn(
			shared,
			kind === 'whole-file' ? 'lockWholeFile' : 'lockFileByteRange'
		);
		if (kind === 'whole-file') {
			await api.lockWholeFile(path, whole);
		} else {
			await api.lockFileByteRange(
				path,
				{ ...range, start: 0, end: 1 },
				false
			);
		}
		spy.mockClear();
		let completed = false;
		const waiting = (
			kind === 'whole-file'
				? api.lockWholeFile(path, {
						...whole,
						pid: 2,
						fd: secondFd,
						waitForLock: true,
					})
				: api.lockFileByteRange(
						path,
						{ ...range, start: 0, end: 1, pid: 2, fd: secondFd },
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
