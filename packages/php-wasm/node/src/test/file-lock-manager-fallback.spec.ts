import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Worker, MessageChannel, type MessagePort } from 'node:worker_threads';
import {
	closeSync,
	mkdtempSync,
	openSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { joinPaths } from '@php-wasm/util';
import {
	FileLockManagerInMemory,
	consumeAPI,
	exposeSyncAPI,
	releaseApiProxy,
	type RemoteAPI,
} from '@php-wasm/universal';
import type { TestWorkerAPI } from './file-lock-manager-test-utils';

const workers: Worker[] = [];
const apis: RemoteAPI<TestWorkerAPI>[] = [];
const channels: MessageChannel[] = [];
let dir: string;
let path: string;
let firstFd: number;
let secondFd: number;
beforeEach(() => {
	dir = mkdtempSync(joinPaths(tmpdir(), 'php-lock-worker-'));
	path = joinPaths(dir, 'file');
	writeFileSync(path, '');
	firstFd = openSync(path, 'r+');
	secondFd = openSync(path, 'r+');
});
afterEach(async () => {
	for (const api of apis) {
		api[releaseApiProxy]();
	}
	await Promise.all(workers.map((worker) => worker.terminate()));
	for (const channel of channels) {
		channel.port1.close();
		channel.port2.close();
	}
	apis.length = 0;
	workers.length = 0;
	channels.length = 0;
	closeSync(firstFd);
	closeSync(secondFd);
	rmSync(dir, { recursive: true, force: true });
	vi.restoreAllMocks();
});

it.each(['whole-file', 'byte-range'])(
	'waits for a %s lock without blocking its shared manager',
	async (kind) => {
		const shared = new FileLockManagerInMemory();
		const api = await createWorker(shared);
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

it('lets two workers finish blocking shared-to-exclusive upgrades', async () => {
	const shared = new FileLockManagerInMemory();
	const spy = vi.spyOn(shared, 'lockWholeFile');
	const workerApis = await Promise.all([
		createWorker(shared),
		createWorker(shared),
	]);
	const requests = [firstFd, secondFd].map((fd, index) => ({
		pid: index + 1,
		fd,
		type: 'shared' as const,
		waitForLock: false,
	}));
	for (const [index, api] of workerApis.entries()) {
		expect(await api.lockWholeFile(path, requests[index])).toBe(true);
	}
	const fileKey = spy.mock.calls[0][0];
	await Promise.all(
		workerApis.map(async (api, index) => {
			const request = requests[index];
			expect(
				await api.lockWholeFile(path, {
					...request,
					type: 'exclusive',
					waitForLock: true,
				})
			).toBe(true);
			expect(
				shared.lockWholeFile(fileKey, {
					pid: 3,
					fd: -1,
					type: 'shared',
				})
			).toBe(false);
			expect(
				await api.lockWholeFile(path, { ...request, type: 'unlock' })
			).toBe(true);
		})
	);
}, 15_000);

/** Starts a fallback worker connected to the parent's shared lock manager. */
async function createWorker(
	shared: FileLockManagerInMemory
): Promise<RemoteAPI<TestWorkerAPI>> {
	const channel = new MessageChannel();
	channels.push(channel);
	await exposeSyncAPI(shared, channel.port1);
	const worker = new Worker(
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
	workers.push(worker);
	const ready = new Promise<{ apiPort: MessagePort }>((resolve, reject) => {
		worker.once('message', resolve);
		worker.once('error', reject);
	});
	worker.postMessage({ inMemoryPort: channel.port2 }, [channel.port2]);
	const api = await consumeAPI<TestWorkerAPI>((await ready).apiPort);
	apis.push(api);
	return api;
}
