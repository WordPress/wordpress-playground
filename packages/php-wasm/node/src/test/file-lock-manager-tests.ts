import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { writeFileSync, unlinkSync } from 'fs';
import { fork, type ChildProcess } from 'child_process';
import {
	Worker as NodeWorkerThread,
	MessageChannel as NodeMessageChannel,
} from 'worker_threads';
import {
	consumeAPI,
	exposeSyncAPI,
	FileLockManagerInMemory,
	releaseApiProxy,
	type RemoteAPI,
	type WholeFileLockOp,
} from '@php-wasm/universal';
import type { TestWorkerAPI } from './file-lock-manager-test-utils';

// TODO: Review all tests with `end: 0` ranges. AI editing seems to have left broken tests.

// TODO: Also test waiting for locks.
export function declareFileLockManagerTests({
	name,
	testWorkerUrl,
	// TODO: Re-enable or remove native tests because these are already native tests.
	// TODO: Leave similar test file for FileLockManagerInMemory.
	shouldSkip = false,
	workerType,
}: {
	name: string;
	testWorkerUrl: URL;
	// We include this arg so we can acknowledge the tests
	// exist but may be skipped (e.g., we skip POSIX tests on Windows).
	shouldSkip?: boolean;
	workerType: 'childProcess' | 'workerThread';
}) {
	return describe.skipIf(shouldSkip)(name, () => {
		let remoteProcessApi1: RemoteAPI<TestWorkerAPI>;
		let remoteProcessApi2: RemoteAPI<TestWorkerAPI>;
		let cleanupProcesses: () => Promise<void>;
		let process1TestFile1Fd: number;
		let process1TestFile2Fd: number;
		let process2TestFile1Fd: number;
		let process2TestFile2Fd: number;

		const PROCESS1_PID = 1;
		const PROCESS2_PID = 2;

		// Use unique file names per suite to avoid conflicts when
		// multiple spec files run in parallel vitest workers.
		const suiteSlug = name.replace(/[^a-zA-Z0-9]+/g, '-');
		const TEST_FILE1_URL = new URL(
			`test1--${suiteSlug}.txt`,
			import.meta.url
		);
		const TEST_FILE2_URL = new URL(
			`test2--${suiteSlug}.txt`,
			import.meta.url
		);

		const EXEC_ARGV = [
			'--experimental-strip-types',
			'--experimental-transform-types',
			'--disable-warning=ExperimentalWarning',
			'--import',
			'./packages/meta/src/node-es-module-loader/register.mts',
		];

		const createLockingProcess = async (): Promise<
			[ChildProcess, RemoteAPI<TestWorkerAPI>]
		> => {
			const child = fork(testWorkerUrl, {
				execArgv: EXEC_ARGV,
				stdio: 'inherit',
			});
			const api = await consumeAPI<TestWorkerAPI>(
				child as unknown as Parameters<typeof consumeAPI>[0]
			);

			return [child, api];
		};

		const createLockingWorkerThread = async (
			sharedInMemoryManager: FileLockManagerInMemory
		): Promise<[NodeWorkerThread, RemoteAPI<TestWorkerAPI>]> => {
			const worker = new NodeWorkerThread(testWorkerUrl, {
				execArgv: EXEC_ARGV,
			});

			// Expose the shared in-memory manager via a sync API
			// so the worker can use it as the wasm lock manager
			// in its FileLockManagerComposite.
			const inMemoryChannel = new NodeMessageChannel();
			await exposeSyncAPI(sharedInMemoryManager, inMemoryChannel.port1);

			// Send the in-memory port to the worker thread.
			worker.postMessage({ inMemoryPort: inMemoryChannel.port2 }, [
				inMemoryChannel.port2,
			]);

			// Wait for the worker to set up its composite and send
			// back the API port.
			const { apiPort } = await new Promise<{ apiPort: any }>(
				(resolve, reject) => {
					worker.on('message', (msg: any) => {
						if (msg.apiPort) {
							resolve(msg);
						}
					});
					worker.on('error', reject);
				}
			);

			// @ts-ignore
			const api = await consumeAPI<TestWorkerAPI>(apiPort);

			return [worker, api];
		};

		const killLockingProcess = (
			childProcess: ChildProcess
		): Promise<void> =>
			new Promise((resolve) => {
				childProcess.on('exit', resolve);
				childProcess.kill();
			});

		const terminateWorkerThread = (
			worker: NodeWorkerThread
		): Promise<void> =>
			new Promise((resolve) => {
				worker.on('exit', () => resolve());
				worker.terminate();
			});

		beforeEach(async () => {
			writeFileSync(TEST_FILE1_URL, `test file 1 for ${import.meta.url}`);
			writeFileSync(TEST_FILE2_URL, `test file 2 for ${import.meta.url}`);

			if (workerType === 'workerThread') {
				const sharedInMemoryManager = new FileLockManagerInMemory();
				const [worker1, api1] = await createLockingWorkerThread(
					sharedInMemoryManager
				);
				const [worker2, api2] = await createLockingWorkerThread(
					sharedInMemoryManager
				);
				remoteProcessApi1 = api1;
				remoteProcessApi2 = api2;
				cleanupProcesses = () =>
					Promise.all([
						terminateWorkerThread(worker1),
						terminateWorkerThread(worker2),
					]).then(() => {});
			} else {
				const [cp1, api1] = await createLockingProcess();
				const [cp2, api2] = await createLockingProcess();
				remoteProcessApi1 = api1;
				remoteProcessApi2 = api2;
				cleanupProcesses = () =>
					Promise.all([
						killLockingProcess(cp1),
						killLockingProcess(cp2),
					]).then(() => {});
			}

			// TODO: Is the below true? I wrote something like this a while ago but remember removing it.
			// ^ Claude re-added it.
			// Pass URL hrefs instead of URL objects because URL
			// objects can't be structured-cloned through Comlink's
			// MessagePort channel (worker threads). The openSync
			// wrapper in file-lock-manager-test-utils.ts converts
			// file:// strings back to URL objects.
			process1TestFile1Fd = await remoteProcessApi1.openSync(
				TEST_FILE1_URL.href,
				'r+'
			);
			process1TestFile2Fd = await remoteProcessApi1.openSync(
				TEST_FILE2_URL.href,
				'r+'
			);
			process2TestFile1Fd = await remoteProcessApi2.openSync(
				TEST_FILE1_URL.href,
				'r+'
			);
			process2TestFile2Fd = await remoteProcessApi2.openSync(
				TEST_FILE2_URL.href,
				'r+'
			);
		});

		afterEach(async () => {
			await Promise.all([
				remoteProcessApi1 && remoteProcessApi1[releaseApiProxy](),
				remoteProcessApi2 && remoteProcessApi2[releaseApiProxy](),
			]);
			await cleanupProcesses();

			unlinkSync(TEST_FILE1_URL);
			unlinkSync(TEST_FILE2_URL);
		});

		describe('lockWholeFile', () => {
			describe('exclusive', () => {
				it('allows when unlocked', async () => {
					const result = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result).toBe(true);
				});

				it('allows when the process already holds a lock with the same file descriptor', async () => {
					const requestedLock: WholeFileLockOp = {
						type: 'exclusive',
						pid: PROCESS1_PID,
						fd: process1TestFile1Fd,
						waitForLock: false,
					};
					const result1 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						requestedLock
					);
					expect(result1).toBe(true);

					const result2 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						requestedLock
					);
					expect(result2).toBe(true);
				});

				it('denies when only whole-file locked by same process with different file descriptor', async () => {
					// First lock
					const result1 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result1).toBe(true);

					const testFile1Fd2 = await remoteProcessApi1.openSync(
						TEST_FILE1_URL.href,
						'r+'
					);
					// Second lock by same process
					const result2 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							pid: PROCESS1_PID,
							fd: testFile1Fd2,
							waitForLock: false,
						}
					);
					expect(result2).toBe(false);
				});

				it('denies when other process holds exclusive whole-file lock', async () => {
					// This process locks
					const result1 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result1).toBe(true);

					// Remote process tries to lock
					const result2 = await remoteProcessApi2.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(false);
				});

				it('denies when other process holds shared whole-file lock', async () => {
					// First process gets shared lock
					const result1 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result1).toBe(true);

					// Second process tries to get exclusive lock
					const result2 = await remoteProcessApi2.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(false);
				});
			});
			describe('shared', () => {
				it('allows when unlocked', async () => {
					const result = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result).toBe(true);
				});

				it('allows when only whole-file locked by same process', async () => {
					const testFile1Fd2 = await remoteProcessApi1.openSync(
						TEST_FILE1_URL.href,
						'r+'
					);
					// First lock
					const result1 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result1).toBe(true);

					// Second lock by same process
					const result2 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							pid: PROCESS1_PID,
							fd: testFile1Fd2,
							waitForLock: false,
						}
					);
					expect(result2).toBe(true);
				});

				it('denies when other process holds exclusive whole-file lock', async () => {
					// First process gets exclusive lock
					const result1 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result1).toBe(true);

					// Second process tries to get shared lock
					const result2 = await remoteProcessApi2.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(false);
				});

				it('allows when same process holds shared whole-file lock', async () => {
					// First process gets shared lock
					const result1 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result1).toBe(true);

					// Second process gets shared lock
					const result2 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(true);
				});

				it('allows when other process holds shared whole-file lock', async () => {
					// First process gets shared lock
					const result1 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result1).toBe(true);

					// Second process gets shared lock
					const result2 = await remoteProcessApi2.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(true);
				});

				it('allows when other process holds shared range lock', async () => {
					// First process gets shared range lock
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process gets shared whole-file lock
					const result2 = await remoteProcessApi2.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(true);
				});
			});
			describe('unlock', () => {
				it('does not error when file already unlocked', async () => {
					const result = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'unlock',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						}
					);
					expect(result).toBe(true);
				});

				it('unlocks shared lock for matching process', async () => {
					// First get a shared lock
					const result1 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result1).toBe(true);

					// Unlock it
					await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'unlock',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						}
					);

					// Verify it's unlocked by getting an exclusive lock for another process
					const result2 = await remoteProcessApi2.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(true);
				});

				it('unlocks exclusive lock for matching process', async () => {
					// First get an exclusive lock
					const result1 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result1).toBe(true);

					// Unlock it
					const result2 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'unlock',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						}
					);
					expect(result2).toBe(true);

					// Verify it's unlocked by getting an exclusive lock
					const result3 = await remoteProcessApi2.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result3).toBe(true);
				});
			});
		});

		describe('lockFileByteRange', () => {
			describe('exclusive', () => {
				it('allows when file unlocked', async () => {
					const result = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result).toBe(true);
				});

				it('denies when other process holds overlapping exclusive range lock', async () => {
					// First process gets exclusive range lock
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 10,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process tries to get overlapping exclusive range lock
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 5,
							end: 15,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(false);
				});

				it('denies when other process holds overlapping shared range lock', async () => {
					// First process gets shared range lock
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process tries to get overlapping exclusive range lock
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(false);
				});

				it('allows when other process holds non-overlapping exclusive range lock', async () => {
					// First process gets exclusive range lock
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 10,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process gets non-overlapping exclusive range lock
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 15,
							end: 20,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});
				// TODO: Test locking to end of addressable range.

				it('allows when other process holds non-overlapping shared range lock', async () => {
					// First process gets shared range lock
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 0,
							end: 10,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process gets non-overlapping exclusive range lock
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 20,
							end: 30,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});

				// TODO: This is not implemented for Windows. Keep it or explicitly enforce no overlap?
				it.skip('new lock request merges with overlapping locks from same process', async () => {
					// First get an exclusive range lock
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Replace it with a new overlapping lock
					const result2 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);

					// Verify the old lock range is in place by trying to get a lock in that range
					const obtainedExclusiveLockOnOldRange =
						await remoteProcessApi2.lockFileByteRange(
							TEST_FILE1_URL.pathname,
							{
								type: 'exclusive',
								start: 0,
								end: 0,
								pid: PROCESS2_PID,
								fd: process2TestFile1Fd,
							},
							false
						);
					expect(obtainedExclusiveLockOnOldRange).toBe(false);

					// Verify the new lock range is in place by trying to get a lock in that range
					const obtainedExclusiveLockOnNewRange =
						await remoteProcessApi2.lockFileByteRange(
							TEST_FILE1_URL.pathname,
							{
								type: 'exclusive',
								start: 0,
								end: 0,
								pid: PROCESS2_PID,
								fd: process2TestFile1Fd,
							},
							false
						);
					expect(obtainedExclusiveLockOnNewRange).toBe(false);
				});

				it('treats a range with zero length as covering entire remaining range', async () => {
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 10,
							end: 10,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Try to get a lock after the zero-length lock
					const result3 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 15,
							end: 20,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result3).toBe(false);
				});
			});
			describe('shared', () => {
				it('allows when file unlocked', async () => {
					const result = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result).toBe(true);
				});

				it('denies when other process holds overlapping exclusive range lock', async () => {
					// First process gets exclusive range lock
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 10,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process tries to get overlapping shared range lock
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 5,
							end: 15,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(false);
				});

				it('allows when other process holds overlapping shared range lock', async () => {
					// First process gets shared range lock
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 0,
							end: 10,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process gets overlapping shared range lock
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 5,
							end: 15,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});

				it('allows when other process holds non-overlapping exclusive range lock', async () => {
					// First process gets exclusive range lock
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 10,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process gets non-overlapping shared range lock
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 15,
							end: 20,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});

				it('allows when other process holds non-overlapping shared range lock', async () => {
					// First process gets shared range lock
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 0,
							end: 10,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process gets non-overlapping shared range lock
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 15,
							end: 20,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});

				// TODO: Re-enable this once native lock managers support fcntl() merging of locked ranges.
				it.skip('new lock request merges with overlapping locks from same process', async () => {
					// First get a shared range lock
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Replace it with a new overlapping lock
					const result2 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);

					// Verify the old lock is gone by trying to get a lock in that range
					const result3 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result3).toBe(true);
				});

				it('treats a range with zero length as covering entire remaining range', async () => {
					// First get a shared range lock with zero length
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 30,
							end: 30,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Confirm correct starting point by getting an exclusive lock
					// before the start of the "infinite" range.
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 10,
							end: 29,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);

					// Confirm the rest of the file is already locked by attempting to exclusively lock
					// within a large part of that range
					const result3 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 40,
							end: Number.MAX_SAFE_INTEGER - 100,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result3).toBe(false);
				});
			});
			describe('unlock', () => {
				it('does not error when range not locked by current process', async () => {
					await expect(
						remoteProcessApi1.lockFileByteRange(
							TEST_FILE1_URL.pathname,
							{
								type: 'unlocked',
								start: 0,
								end: 0,
								pid: PROCESS1_PID,
								fd: process1TestFile1Fd,
							},
							false
						)
					).resolves.toBeDefined();
				});

				it('unlocks shared lock', async () => {
					// First get a shared range lock
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Unlock it
					await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'unlocked',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);

					// Verify it's unlocked by getting an exclusive lock
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});

				it('unlocks exclusive lock', async () => {
					// First get an exclusive range lock
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Unlock it
					await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'unlocked',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);

					// Verify it's unlocked by getting an exclusive lock
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});

				// TODO: Re-enable this once native lock managers support fcntl() partial range unlocking.
				it.skip('unlocks tail of owned locked range when that range overlaps head of unlocked range', async () => {
					// Get a lock from 0-100
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Unlock range 50-150 which overlaps tail of existing lock
					await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'unlocked',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);

					// Verify we can now lock 50-100 but not 0-50
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);

					const result3 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result3).toBe(false);
				});

				// TODO: Re-enable this once native lock managers support fcntl() partial range unlocking.
				it.skip('unlocks head of owned locked range when that range overlaps tail of unlocked range', async () => {
					// Get a lock from 50-150
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Unlock range 0-100 which overlaps head of existing lock
					await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'unlocked',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);

					// Verify we can now lock 50-100 but not 100-150
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);

					const result3 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result3).toBe(false);
				});

				// TODO: Re-enable this once native lock managers support fcntl() splitting of locked ranges.
				it.skip('splits locked range when that range completely contains unlocked range', async () => {
					// Get a lock from 0-200
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Unlock range 50-150 which is contained within existing lock
					await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'unlocked',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);

					// Verify we can now lock 50-150 but not 0-50 or 150-200
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);

					const result3 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result3).toBe(false);

					const result4 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result4).toBe(false);
				});

				it('treats a range with zero length as covering entire remaining range', async () => {
					// First get a lock with zero length
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Unlock it
					await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'unlocked',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);

					// Verify it's unlocked by getting a lock after that point
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});
			});
		});

		describe('findFirstConflictingByteRangeLock', () => {
			it('should find conflicting exclusive lock with partial overlap', async () => {
				await remoteProcessApi1.lockFileByteRange(
					TEST_FILE1_URL.pathname,
					{
						type: 'exclusive',
						start: 0,
						end: 0,
						pid: PROCESS1_PID,
						fd: process1TestFile1Fd,
					},
					false
				);

				const conflict =
					await remoteProcessApi2.findFirstConflictingByteRangeLock(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						}
					);

				expect(conflict).toBeDefined();
				expect(conflict?.type).toBe('exclusive');
				// Native managers report -1 (can't query the real PID on
				// Windows and we don't on POSIX either). The in-memory
				// manager reports the actual PID. In worker thread mode
				// with shared in-memory, the in-memory manager detects
				// the conflict (same OS process, so native sees no
				// conflict), returning PROCESS1_PID.
				expect([-1, PROCESS1_PID]).toContain(conflict?.pid);
			});

			it('should return undefined when no conflict exists', async () => {
				const conflict =
					await remoteProcessApi2.findFirstConflictingByteRangeLock(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 20,
							end: 30,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						}
					);

				expect(conflict).toBeUndefined();
			});
		});

		describe('releaseLocksForProcess', () => {
			it('should release all range locks held by a process across multiple ranges', async () => {
				await remoteProcessApi1.lockFileByteRange(
					TEST_FILE1_URL.pathname,
					{
						type: 'exclusive',
						start: 50,
						end: 100,
						pid: PROCESS1_PID,
						fd: process1TestFile1Fd,
					},
					false
				);
				await remoteProcessApi1.lockFileByteRange(
					TEST_FILE1_URL.pathname,
					{
						type: 'exclusive',
						start: 200,
						end: 300,
						pid: PROCESS1_PID,
						fd: process1TestFile1Fd,
					},
					false
				);
				const exclusiveLockAppearsToBeHeld =
					!(await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 0,
							end: 500,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					));
				expect(exclusiveLockAppearsToBeHeld).toBe(true);

				await remoteProcessApi1.lockFileByteRange(
					TEST_FILE2_URL.pathname,
					{
						type: 'shared',
						start: 50,
						end: 100,
						pid: PROCESS1_PID,
						fd: process1TestFile2Fd,
					},
					false
				);
				const sharedLockAppearsToBeHeld =
					!(await remoteProcessApi2.lockFileByteRange(
						TEST_FILE2_URL.pathname,
						{
							type: 'exclusive',
							start: 25,
							end: 150,
							pid: PROCESS2_PID,
							fd: process2TestFile2Fd,
						},
						false
					));
				expect(sharedLockAppearsToBeHeld).toBe(true);

				await remoteProcessApi1.releaseLocksForProcess(PROCESS1_PID);

				// Verify locks are released by trying to acquire conflicting locks
				const exclusiveLockAppearsToBeReleased =
					await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							start: 0,
							end: 500,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
				const sharedLockAppearsToBeReleased =
					await remoteProcessApi2.lockFileByteRange(
						TEST_FILE2_URL.pathname,
						{
							type: 'exclusive',
							start: 25,
							end: 150,
							pid: PROCESS2_PID,
							fd: process2TestFile2Fd,
						},
						false
					);

				expect(exclusiveLockAppearsToBeReleased).toBe(true);
				expect(sharedLockAppearsToBeReleased).toBe(true);
			});

			it('should release all whole-file locks held by a process', async () => {
				await remoteProcessApi1.lockWholeFile(TEST_FILE1_URL.pathname, {
					type: 'exclusive',

					pid: PROCESS1_PID,
					fd: process1TestFile1Fd,
					waitForLock: false,
				});
				const exclusiveLockAppearsToBeHeld =
					!(await remoteProcessApi2.lockWholeFile(
						TEST_FILE1_URL.pathname,
						{
							type: 'shared',
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
							waitForLock: false,
						}
					));
				expect(exclusiveLockAppearsToBeHeld).toBe(true);

				await remoteProcessApi1.lockWholeFile(TEST_FILE2_URL.pathname, {
					type: 'shared',
					pid: PROCESS1_PID,
					fd: process1TestFile2Fd,
					waitForLock: false,
				});
				const sharedLockAppearsToBeHeld =
					!(await remoteProcessApi2.lockWholeFile(
						TEST_FILE2_URL.pathname,
						{
							type: 'exclusive',
							pid: PROCESS2_PID,
							fd: process2TestFile2Fd,
							waitForLock: false,
						}
					));
				expect(sharedLockAppearsToBeHeld).toBe(true);

				await remoteProcessApi1.releaseLocksForProcess(PROCESS1_PID);

				const lockToConfirmExclusiveLockRelease: WholeFileLockOp = {
					type: 'shared',
					pid: PROCESS2_PID,
					fd: process2TestFile1Fd,
					waitForLock: false,
				};
				const exclusiveLockAppearsToBeReleased =
					await remoteProcessApi2.lockWholeFile(
						TEST_FILE2_URL.pathname,
						lockToConfirmExclusiveLockRelease
					);
				expect(exclusiveLockAppearsToBeReleased).toBe(true);
				const sharedLockAppearsToBeReleased =
					await remoteProcessApi2.lockWholeFile(
						TEST_FILE2_URL.pathname,
						{
							type: 'exclusive',
							pid: PROCESS2_PID,
							fd: process2TestFile2Fd,
							waitForLock: false,
						}
					);
				expect(sharedLockAppearsToBeReleased).toBe(true);
			});
		});
	});
}
