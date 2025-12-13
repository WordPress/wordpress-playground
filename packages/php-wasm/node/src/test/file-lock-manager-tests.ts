import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { writeFileSync, unlinkSync } from 'fs';
import { fork, type ChildProcess } from 'child_process';
import {
	consumeAPI,
	type RemoteAPI,
	type WholeFileLockOp,
} from '@php-wasm/universal';
import type { TestWorkerAPI } from './file-lock-manager-test-utils';

// TODO: Also test waiting for locks.
export function declareFileLockManagerTests({
	name,
	testWorkerUrl,
	// TODO: Re-enable or remove native tests because these are already native tests.
	// TODO: Leave similar test file for FileLockManagerInMemory.
	shouldSkip = false,
}: {
	name: string;
	testWorkerUrl: URL;
	// We include this arg so we can acknowledge the tests
	// exist but may be skipped (e.g., we skip POSIX tests on Windows).
	shouldSkip?: boolean;
}) {
	return describe.skipIf(shouldSkip)(name, () => {
		let childProcess1: ChildProcess;
		let childProcess2: ChildProcess;
		let remoteProcessApi1: RemoteAPI<TestWorkerAPI>;
		let remoteProcessApi2: RemoteAPI<TestWorkerAPI>;
		let process1TestFile1Fd: number;
		let process1TestFile2Fd: number;
		let process2TestFile1Fd: number;
		let process2TestFile2Fd: number;

		const PROCESS1_PID = 1;
		const PROCESS2_PID = 2;

		const TEST_FILE1 = new URL('test1.txt', import.meta.url).pathname;
		const TEST_FILE2 = new URL('test2.txt', import.meta.url).pathname;

		const createLockingProcess = async (): Promise<
			[ChildProcess, RemoteAPI<TestWorkerAPI>]
		> => {
			const child = fork(testWorkerUrl, {
				execArgv: [
					'--experimental-strip-types',
					'--experimental-transform-types',
					'--disable-warning=ExperimentalWarning',
					'--import',
					'./packages/meta/src/node-es-module-loader/register.mts',
				],
				stdio: 'inherit',
			});
			// TODO: Fix this type error.
			// @ts-ignore
			const api = await consumeAPI<TestWorkerAPI>(child);

			return [child, api];
		};
		const killLockingProcess = (
			childProcess: ChildProcess
		): Promise<void> =>
			new Promise((resolve) => {
				childProcess.on('exit', resolve);
				childProcess.kill();
			});

		beforeEach(async () => {
			writeFileSync(TEST_FILE1, `test file 1 for ${import.meta.url}`);
			writeFileSync(TEST_FILE2, `test file 2 for ${import.meta.url}`);

			[childProcess1, remoteProcessApi1] = await createLockingProcess();
			[childProcess2, remoteProcessApi2] = await createLockingProcess();

			process1TestFile1Fd = await remoteProcessApi1.openSync(
				TEST_FILE1,
				'r+'
			);
			process1TestFile2Fd = await remoteProcessApi1.openSync(
				TEST_FILE2,
				'r+'
			);
			process2TestFile1Fd = await remoteProcessApi2.openSync(
				TEST_FILE1,
				'r+'
			);
			process2TestFile2Fd = await remoteProcessApi2.openSync(
				TEST_FILE2,
				'r+'
			);
		});

		afterEach(async () => {
			await Promise.all([
				killLockingProcess(childProcess1),
				killLockingProcess(childProcess2),
			]);

			unlinkSync(TEST_FILE1);
			unlinkSync(TEST_FILE2);
		});

		describe('lockWholeFile', () => {
			describe('exclusive', () => {
				it('allows when unlocked', async () => {
					const result = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1,
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
						TEST_FILE1,
						requestedLock
					);
					expect(result1).toBe(true);

					const result2 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1,
						requestedLock
					);
					expect(result2).toBe(true);
				});

				// TODO: In Windows, the second open may fail because of the exclusive lock on the first fd.
				it('denies when only whole-file locked by same process with different file descriptor', async () => {
					// First lock
					const result1 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1,
						{
							type: 'exclusive',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result1).toBe(true);

					const testFile1Fd2 = await remoteProcessApi1.openSync(
						TEST_FILE1,
						'r'
					);
					// Second lock by same process
					const result2 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
						{
							type: 'exclusive',
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(false);
				});

				it('denies when other process holds shared range lock', async () => {
					// First process gets shared range lock
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1,
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

					// Second process tries to get exclusive whole-file lock
					const result2 = await remoteProcessApi2.lockWholeFile(
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
						'r'
					);
					// First lock
					const result1 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
						{
							type: 'shared',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result1).toBe(true);

					// Unlock it
					await remoteProcessApi1.lockWholeFile(TEST_FILE1, {
						type: 'unlock',
						pid: PROCESS1_PID,
						fd: process1TestFile1Fd,
					});

					// Verify it's unlocked by getting an exclusive lock for another process
					const result2 = await remoteProcessApi2.lockWholeFile(
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
						{
							type: 'unlock',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						}
					);
					expect(result2).toBe(true);

					// Verify it's unlocked by getting an exclusive lock
					const result3 = await remoteProcessApi2.lockWholeFile(
						TEST_FILE1,
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
						TEST_FILE1,
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

				it('denies when other process holds exclusive whole-file lock', async () => {
					// First process gets exclusive whole-file lock
					const result1 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1,
						{
							type: 'exclusive',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result1).toBe(true);

					// Second process tries to get exclusive range lock
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1,
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

				it('denies when other process holds shared whole-file lock', async () => {
					// First process gets shared whole-file lock
					const result1 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1,
						{
							type: 'shared',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result1).toBe(true);

					// Second process tries to get exclusive range lock
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1,
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

				it('denies when other process holds overlapping exclusive range lock', async () => {
					// First process gets exclusive range lock
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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

				it('new lock request merges with overlapping locks from same process', async () => {
					// First get an exclusive range lock
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1,
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
						TEST_FILE1,
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
							TEST_FILE1,
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
							TEST_FILE1,
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
					// First get an exclusive range lock with zero length
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1,
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

					// Try to get a lock in the remaining range
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1,
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

					// Try to get a lock after the zero-length lock
					const result3 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1,
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
			});
			describe('shared', () => {
				it('allows when file unlocked', async () => {
					const result = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1,
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

				it('denies when other process holds exclusive whole-file lock', async () => {
					// First process gets exclusive whole-file lock
					const result1 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1,
						{
							type: 'exclusive',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result1).toBe(true);

					// Second process tries to get shared range lock
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(false);
				});

				it('allows when other process holds shared whole-file lock', async () => {
					// First process gets shared whole-file lock
					const result1 = await remoteProcessApi1.lockWholeFile(
						TEST_FILE1,
						{
							type: 'shared',
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result1).toBe(true);

					// Second process gets shared range lock
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});

				it('denies when other process holds overlapping exclusive range lock', async () => {
					// First process gets exclusive range lock
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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

					// Confirm correct starting point by getting an exclusive lock
					// before the start of the "infinite" range.
					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1,
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

					// Confirm the rest of the file is already locked by attempting to exclusively lock
					// within a large part of that range
					const result3 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0,
							end: Number.MAX_SAFE_INTEGER,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
					expect(result3).toBe(false);
				});
			});
			describe.skip('unlock', () => {
				it('does not error when range not locked by current process', async () => {
					await expect(
						remoteProcessApi1.lockFileByteRange(
							TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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

				it('leaves locks owned by other processes intact', async () => {
					// First process gets two locks
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1,
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

					const result2 = await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1,
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

					// Unlock the first process's lock
					await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'unlocked',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);

					// Verify second process's lock is still there
					const result3 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS1_PID,
							fd: process1TestFile1Fd,
						},
						false
					);
					expect(result3).toBe(false);
				});
				it('unlocks tail of owned locked range when that range overlaps head of unlocked range', async () => {
					// Get a lock from 0-100
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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

				// TODO: Re-enable this once native lock managers support fcntl() partial unlocking of locked ranges.
				it.skip('unlocks head of owned locked range when that range overlaps tail of unlocked range', async () => {
					// Get a lock from 50-150
					const result1 = await remoteProcessApi1.lockFileByteRange(
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
						TEST_FILE1,
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
					TEST_FILE1,
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
						TEST_FILE1,
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
				// We cannot query what lock truly conflicts on Windows,
				// so we report a non-standard dummy PID.
				expect(conflict?.pid).toBe(-1);
				// TODO: Consider removing this because it is unlikely to every be supported
				// because Windows has no way to query info about conflicting locks.
				// TODO: Uncomment this once we are able to query what lock truly conflicts.
				// expect(conflict?.pid).toBe(PROCESS1_PID);
			});

			it('should return undefined when no conflict exists', async () => {
				await remoteProcessApi1.lockFileByteRange(
					TEST_FILE1,
					{
						type: 'shared',
						start: 0,
						end: 10,
						pid: PROCESS1_PID,
						fd: process1TestFile1Fd,
					},
					false
				);

				const conflict =
					await remoteProcessApi2.findFirstConflictingByteRangeLock(
						TEST_FILE1,
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

			// TODO: Probably drop this test because fcntl() and flock() ops don't conflict on all platforms.
			it.skip('should handle an exclusive range lock conflict with a shared whole-file lock', async () => {
				// First get an exclusive whole-file lock
				const result1 = await remoteProcessApi1.lockWholeFile(
					TEST_FILE1,
					{
						type: 'exclusive',
						pid: PROCESS1_PID,
						fd: process1TestFile1Fd,
						waitForLock: false,
					}
				);
				expect(result1).toBe(true);

				// Try to get a range lock
				const conflict =
					await remoteProcessApi1.findFirstConflictingByteRangeLock(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process1TestFile1Fd,
						}
					);

				expect(conflict).toEqual({
					type: 'exclusive',
					start: 0,
					end: 0,
					pid: -1,
				});
			});

			// TODO: Probably drop this test because fcntl() and flock() ops don't conflict on all platforms.
			it.skip('should handle an exclusive range lock conflict with an exclusive whole-file lock', async () => {
				// First get an exclusive whole-file lock
				const result1 = await remoteProcessApi1.lockWholeFile(
					TEST_FILE1,
					{
						type: 'exclusive',
						pid: PROCESS1_PID,
						fd: process1TestFile1Fd,
						waitForLock: false,
					}
				);
				expect(result1).toBe(true);

				// Try to get a range lock
				const conflict =
					await remoteProcessApi1.findFirstConflictingByteRangeLock(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process1TestFile1Fd,
						}
					);

				expect(conflict).toEqual({
					type: 'exclusive',
					start: 0,
					end: 0,
					pid: -1,
				});
			});

			// TODO: Probably drop this test because fcntl() and flock() ops don't conflict on all platforms.
			it.skip('should handle a shared range lock conflict with an exclusive whole-file lock', async () => {
				// First get an exclusive whole-file lock
				const result1 = await remoteProcessApi1.lockWholeFile(
					TEST_FILE1,
					{
						type: 'shared',
						pid: PROCESS1_PID,
						fd: process1TestFile1Fd,
						waitForLock: false,
					}
				);
				expect(result1).toBe(true);

				// Try to get a range lock
				const conflict =
					await remoteProcessApi1.findFirstConflictingByteRangeLock(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process1TestFile1Fd,
						}
					);

				expect(conflict).toEqual({
					type: 'shared',
					start: 0,
					end: 0,
					pid: -1,
				});
			});
		});

		describe('releaseLocksForProcess', () => {
			it('should release all range locks held by a process across multiple ranges', async () => {
				await remoteProcessApi1.lockFileByteRange(
					TEST_FILE1,
					{
						type: 'exclusive',
						start: 0,
						end: 0,
						pid: PROCESS1_PID,
						fd: process1TestFile1Fd,
					},
					false
				);
				await remoteProcessApi1.lockFileByteRange(
					TEST_FILE1,
					{
						type: 'exclusive',
						start: 0,
						end: 0,
						pid: PROCESS1_PID,
						fd: process1TestFile1Fd,
					},
					false
				);
				const exclusiveLockAppearsToBeHeld =
					!(await remoteProcessApi2.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					));
				expect(exclusiveLockAppearsToBeHeld).toBe(true);

				await remoteProcessApi1.lockFileByteRange(
					TEST_FILE2,
					{
						type: 'shared',
						start: 0,
						end: 0,
						pid: PROCESS1_PID,
						fd: process1TestFile2Fd,
					},
					false
				);
				const sharedLockAppearsToBeHeld =
					!(await remoteProcessApi2.lockFileByteRange(
						TEST_FILE2,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
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
						TEST_FILE1,
						{
							type: 'shared',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile1Fd,
						},
						false
					);
				const sharedLockAppearsToBeReleased =
					await remoteProcessApi2.lockFileByteRange(
						TEST_FILE2,
						{
							type: 'exclusive',
							start: 0,
							end: 0,
							pid: PROCESS2_PID,
							fd: process2TestFile2Fd,
						},
						false
					);

				expect(exclusiveLockAppearsToBeReleased).toBe(true);
				expect(sharedLockAppearsToBeReleased).toBe(true);
			});

			it('should release all whole-file locks held by a process', async () => {
				await remoteProcessApi1.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: PROCESS1_PID,
					fd: process1TestFile1Fd,
					waitForLock: false,
				});
				const exclusiveLockAppearsToBeHeld =
					!(await remoteProcessApi2.lockWholeFile(TEST_FILE1, {
						type: 'shared',
						pid: PROCESS2_PID,
						fd: process2TestFile1Fd,
						waitForLock: false,
					}));
				expect(exclusiveLockAppearsToBeHeld).toBe(true);

				await remoteProcessApi1.lockWholeFile(TEST_FILE2, {
					type: 'shared',
					pid: PROCESS1_PID,
					fd: process1TestFile2Fd,
					waitForLock: false,
				});
				const sharedLockAppearsToBeHeld =
					!(await remoteProcessApi2.lockWholeFile(TEST_FILE2, {
						type: 'exclusive',
						pid: PROCESS2_PID,
						fd: process2TestFile2Fd,
						waitForLock: false,
					}));
				expect(sharedLockAppearsToBeHeld).toBe(true);

				await remoteProcessApi1.releaseLocksForProcess(PROCESS1_PID);

				const exclusiveLockAppearsToBeReleased =
					await remoteProcessApi2.lockWholeFile(TEST_FILE1, {
						type: 'shared',
						pid: PROCESS2_PID,
						fd: process2TestFile2Fd,
						waitForLock: false,
					});
				const sharedLockAppearsToBeReleased =
					await remoteProcessApi2.lockWholeFile(TEST_FILE2, {
						type: 'exclusive',
						pid: PROCESS2_PID,
						fd: process2TestFile2Fd,
						waitForLock: false,
					});

				expect(exclusiveLockAppearsToBeReleased).toBe(true);
				expect(sharedLockAppearsToBeReleased).toBe(true);
			});

			it('leaves locks owned by others intact', async () => {
				// First process gets two locks
				await remoteProcessApi1.lockFileByteRange(
					TEST_FILE1,
					{
						type: 'exclusive',
						start: 0,
						end: 0,
						pid: PROCESS1_PID,
						fd: process1TestFile1Fd,
					},
					false
				);

				await remoteProcessApi1.lockFileByteRange(
					TEST_FILE1,
					{
						type: 'exclusive',
						start: 0,
						end: 0,
						pid: PROCESS2_PID,
						fd: process1TestFile1Fd,
					},
					false
				);

				// Release first process's locks
				await remoteProcessApi1.releaseLocksForProcess(PROCESS1_PID);

				// Verify second process's lock is still there
				const result = await remoteProcessApi1.lockFileByteRange(
					TEST_FILE1,
					{
						type: 'exclusive',
						start: 0,
						end: 0,
						pid: PROCESS1_PID,
						fd: process1TestFile1Fd,
					},
					false
				);
				expect(result).toBe(false);
			});
		});
	});
}
