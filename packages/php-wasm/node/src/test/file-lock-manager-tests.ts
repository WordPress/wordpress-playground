import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { writeFileSync, unlinkSync, openSync, closeSync } from 'fs';
import { fork, type ChildProcess } from 'child_process';
import {
	consumeAPI,
	type RemoteAPI,
	type FileLockManager,
	type WholeFileLockOp,
} from '@php-wasm/universal';

const TEST_FILE1 = new URL('test1.txt', import.meta.url).pathname;
const TEST_FILE2 = new URL('test2.txt', import.meta.url).pathname;

export type TestWorkerAPI = FileLockManager & {
	openSync: typeof openSync;
	closeSync: typeof closeSync;
};

// TODO: Also test waiting for locks.
export function declareFileLockManagerTests({
	name,
	fileLockManagerFactory,
	testWorkerUrl,
	// TODO: Re-enable or remove native tests because these are already native tests.
	// TODO: Leave similar test file for FileLockManagerInMemory.
	shouldSkip = false,
}: {
	name: string;
	fileLockManagerFactory: () => FileLockManager;
	testWorkerUrl: URL;
	// We include this arg so we can acknowledge the tests
	// exist but may be skipped (e.g., we skip POSIX tests on Windows).
	shouldSkip?: boolean;
}) {
	return describe.skipIf(shouldSkip)(name, () => {
		let childProcess: ChildProcess;
		let remoteProcessApi: RemoteAPI<TestWorkerAPI>;
		let lockManager: FileLockManager;
		let localTestFile1Fd: number;
		let localTestFile2Fd: number;
		let remoteTestFile1Fd: number;
		let remoteTestFile2Fd: number;

		beforeEach(async () => {
			childProcess = fork(testWorkerUrl, {
				execArgv: [
					'--experimental-strip-types',
					'--experimental-transform-types',
					'--disable-warning=ExperimentalWarning',
					'--import',
					'./packages/meta/src/node-es-module-loader/register.mts',
				],
				stdio: 'pipe',
			});
			// TODO: Fix this type error.
			// @ts-ignore
			remoteProcessApi = await consumeAPI<TestWorkerAPI>(childProcess);

			lockManager = fileLockManagerFactory();
			writeFileSync(TEST_FILE1, `test file 1 for ${import.meta.url}`);
			writeFileSync(TEST_FILE2, `test file 2 for ${import.meta.url}`);

			localTestFile1Fd = openSync(TEST_FILE1, 'r');
			localTestFile2Fd = openSync(TEST_FILE2, 'r');
			remoteTestFile1Fd = await remoteProcessApi.openSync(
				TEST_FILE1,
				'r'
			);
			remoteTestFile2Fd = await remoteProcessApi.openSync(
				TEST_FILE2,
				'r'
			);
		});

		afterEach(async () => {
			try {
				closeSync(localTestFile1Fd);
				closeSync(localTestFile2Fd);
			} catch {
				// ignore
			}

			try {
				await remoteProcessApi.closeSync(remoteTestFile1Fd);
				await remoteProcessApi.closeSync(remoteTestFile2Fd);
			} catch {
				// ignore
			}

			unlinkSync(TEST_FILE1);
			unlinkSync(TEST_FILE2);

			await new Promise((resolve) => {
				childProcess.kill();
				childProcess.on('exit', resolve);
			});
		});

		describe('lockWholeFile', () => {
			describe('exclusive', () => {
				it('allows when unlocked', async () => {
					const testFile1Fd = openSync(TEST_FILE1, 'r');
					try {
						const result = lockManager.lockWholeFile(TEST_FILE1, {
							type: 'exclusive',
							pid: 1,
							fd: testFile1Fd,
							waitForLock: false,
						});
						expect(result).toBe(true);
					} finally {
						closeSync(testFile1Fd);
					}
				});

				it('allows when the process already holds a lock with the same file descriptor', async () => {
					const testFile1Fd = openSync(TEST_FILE1, 'r');
					try {
						const requestedLock: WholeFileLockOp = {
							type: 'exclusive',
							pid: 1,
							fd: testFile1Fd,
							waitForLock: false,
						};
						const result1 = lockManager.lockWholeFile(
							TEST_FILE1,
							requestedLock
						);
						expect(result1).toBe(true);

						const result2 = lockManager.lockWholeFile(
							TEST_FILE1,
							requestedLock
						);
						expect(result2).toBe(true);
					} finally {
						closeSync(testFile1Fd);
					}
				});

				// TODO: In Windows, the second open may fail because of the exclusive lock on the first fd.
				it('denies when only whole-file locked by same process with different file descriptor', async () => {
					// First lock
					const testFile1Fd1 = openSync(TEST_FILE1, 'r');
					const result1 = lockManager.lockWholeFile(TEST_FILE1, {
						type: 'exclusive',
						pid: 1,
						fd: testFile1Fd1,
						waitForLock: false,
					});
					expect(result1).toBe(true);

					const testFile1Fd2 = openSync(TEST_FILE1, 'r');
					try {
						// Second lock by same process
						const result2 = lockManager.lockWholeFile(TEST_FILE1, {
							type: 'exclusive',
							pid: 1,
							fd: testFile1Fd2,
							waitForLock: false,
						});
						expect(result2).toBe(false);
					} finally {
						closeSync(testFile1Fd2);
					}
				});

				// TODO: Drop test or implement compatibility layer. On Linux because fcntl() and flock()
				// locks are separate, we do not expect them to conflict.
				it('denies when byte-range locked by same process', async () => {
					// First get a byte range lock
					const result1 = await lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Try to get whole file lock with same pid
					const result2 = await lockManager.lockWholeFile(
						TEST_FILE1,
						{
							type: 'exclusive',
							pid: 1,
							fd: localTestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(false);
				});

				it('denies when other process holds exclusive whole-file lock', async () => {
					// This process locks
					const result1 = lockManager.lockWholeFile(TEST_FILE1, {
						type: 'exclusive',
						pid: 1,
						fd: localTestFile1Fd,
						waitForLock: false,
					});
					expect(result1).toBe(true);

					// Remote process tries to lock
					const result2 = await remoteProcessApi.lockWholeFile(
						TEST_FILE1,
						{
							type: 'exclusive',
							pid: 2,
							fd: remoteTestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(false);
				});

				it('denies when other process holds shared whole-file lock', async () => {
					// First process gets shared lock
					const result1 = lockManager.lockWholeFile(TEST_FILE1, {
						type: 'shared',
						pid: 1,
						fd: localTestFile1Fd,
						waitForLock: false,
					});
					expect(result1).toBe(true);

					// Second process tries to get exclusive lock
					const result2 = await remoteProcessApi.lockWholeFile(
						TEST_FILE1,
						{
							type: 'exclusive',
							pid: 2,
							fd: remoteTestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(false);
				});

				it('denies when other process holds exclusive range lock', async () => {
					// First process gets exclusive range lock
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process tries to get exclusive whole-file lock
					const result2 = await remoteProcessApi.lockWholeFile(
						TEST_FILE1,
						{
							type: 'exclusive',
							pid: 2,
							fd: remoteTestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(false);
				});

				it('denies when other process holds shared range lock', async () => {
					// First process gets shared range lock
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process tries to get exclusive whole-file lock
					const result2 = await remoteProcessApi.lockWholeFile(
						TEST_FILE1,
						{
							type: 'exclusive',
							pid: 2,
							fd: remoteTestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(false);
				});
			});
			describe('shared', () => {
				it('allows when unlocked', async () => {
					const result = lockManager.lockWholeFile(TEST_FILE1, {
						type: 'shared',
						pid: 1,
						fd: localTestFile1Fd,
						waitForLock: false,
					});
					expect(result).toBe(true);
				});

				it('allows when only whole-file locked by same process', async () => {
					const testFile1Fd2 = openSync(TEST_FILE1, 'r');
					try {
						// First lock
						const result1 = lockManager.lockWholeFile(TEST_FILE1, {
							type: 'shared',
							pid: 1,
							fd: localTestFile1Fd,
							waitForLock: false,
						});
						expect(result1).toBe(true);

						// Second lock by same process
						const result2 = lockManager.lockWholeFile(TEST_FILE1, {
							type: 'shared',
							pid: 1,
							fd: testFile1Fd2,
							waitForLock: false,
						});
						expect(result2).toBe(true);
					} finally {
						closeSync(testFile1Fd2);
					}
				});

				it('denies when only exclusively byte-range locked by same process', async () => {
					// First get a byte range lock
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					const testFile1Fd2 = openSync(TEST_FILE1, 'r');
					try {
						// Same process tries to get shared whole-file lock
						const result2 = lockManager.lockWholeFile(TEST_FILE1, {
							type: 'shared',
							pid: 1,
							fd: testFile1Fd2,
							waitForLock: false,
						});
						expect(result2).toBe(false);
					} finally {
						closeSync(testFile1Fd2);
					}
				});

				it('denies when other process holds exclusive whole-file lock', async () => {
					// First process gets exclusive lock
					const result1 = lockManager.lockWholeFile(TEST_FILE1, {
						type: 'exclusive',
						pid: 1,
						fd: localTestFile1Fd,
						waitForLock: false,
					});
					expect(result1).toBe(true);

					// Second process tries to get shared lock
					const result2 = await remoteProcessApi.lockWholeFile(
						TEST_FILE1,
						{
							type: 'shared',
							pid: 2,
							fd: remoteTestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(false);
				});

				it('allows when same process holds shared whole-file lock', async () => {
					// First process gets shared lock
					const result1 = lockManager.lockWholeFile(TEST_FILE1, {
						type: 'shared',
						pid: 1,
						fd: localTestFile1Fd,
						waitForLock: false,
					});
					expect(result1).toBe(true);

					// Second process gets shared lock
					const result2 = lockManager.lockWholeFile(TEST_FILE1, {
						type: 'shared',
						pid: 1,
						fd: localTestFile1Fd,
						waitForLock: false,
					});
					expect(result2).toBe(true);
				});

				it('allows when other process holds shared whole-file lock', async () => {
					// First process gets shared lock
					const result1 = lockManager.lockWholeFile(TEST_FILE1, {
						type: 'shared',
						pid: 1,
						fd: localTestFile1Fd,
						waitForLock: false,
					});
					expect(result1).toBe(true);

					// Second process gets shared lock
					const result2 = await remoteProcessApi.lockWholeFile(
						TEST_FILE1,
						{
							type: 'shared',
							pid: 2,
							fd: remoteTestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(true);
				});

				it('denies when other process holds exclusive range lock', async () => {
					// First process gets exclusive range lock
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process tries to get shared whole-file lock
					const result2 = await remoteProcessApi.lockWholeFile(
						TEST_FILE1,
						{
							type: 'shared',
							pid: 2,
							fd: remoteTestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(false);
				});

				it('allows when other process holds shared range lock', async () => {
					// First process gets shared range lock
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process gets shared whole-file lock
					const result2 = await remoteProcessApi.lockWholeFile(
						TEST_FILE1,
						{
							type: 'shared',
							pid: 2,
							fd: remoteTestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(true);
				});
			});
			describe('unlock', () => {
				it('does not error when file already unlocked', async () => {
					const result = lockManager.lockWholeFile(TEST_FILE1, {
						type: 'unlock',
						pid: 1,
						fd: localTestFile1Fd,
					});
					expect(result).toBe(true);
				});

				it('unlocks shared lock for matching process', async () => {
					// First get a shared lock
					const result1 = lockManager.lockWholeFile(TEST_FILE1, {
						type: 'shared',
						pid: 1,
						fd: localTestFile1Fd,
						waitForLock: false,
					});
					expect(result1).toBe(true);

					// Unlock it
					lockManager.lockWholeFile(TEST_FILE1, {
						type: 'unlock',
						pid: 1,
						fd: localTestFile1Fd,
					});

					// Verify it's unlocked by getting an exclusive lock for another process
					const result2 = await remoteProcessApi.lockWholeFile(
						TEST_FILE1,
						{
							type: 'exclusive',
							pid: 2,
							fd: remoteTestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result2).toBe(true);
				});

				it('unlocks exclusive lock for matching process', async () => {
					// First get an exclusive lock
					const result1 = lockManager.lockWholeFile(TEST_FILE1, {
						type: 'exclusive',
						pid: 1,
						fd: localTestFile1Fd,
						waitForLock: false,
					});
					expect(result1).toBe(true);

					// Unlock it
					const result2 = lockManager.lockWholeFile(TEST_FILE1, {
						type: 'unlock',
						pid: 1,
						fd: localTestFile1Fd,
					});
					expect(result2).toBe(true);

					// Verify it's unlocked by getting an exclusive lock
					const result3 = await remoteProcessApi.lockWholeFile(
						TEST_FILE1,
						{
							type: 'exclusive',
							pid: 2,
							fd: remoteTestFile1Fd,
							waitForLock: false,
						}
					);
					expect(result3).toBe(true);
				});
			});
		});

		describe.skip('lockFileByteRange', () => {
			describe('exclusive', () => {
				it('allows when file unlocked', async () => {
					const result = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result).toBe(true);
				});

				it('denies when other process holds exclusive whole-file lock', async () => {
					// First process gets exclusive whole-file lock
					const result1 = lockManager.lockWholeFile(TEST_FILE1, {
						type: 'exclusive',
						pid: 1,
						fd: localTestFile1Fd,
						waitForLock: false,
					});
					expect(result1).toBe(true);

					// Second process tries to get exclusive range lock
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(false);
				});

				it('denies when other process holds shared whole-file lock', async () => {
					// First process gets shared whole-file lock
					const result1 = lockManager.lockWholeFile(TEST_FILE1, {
						type: 'shared',
						pid: 1,
						fd: localTestFile1Fd,
						waitForLock: false,
					});
					expect(result1).toBe(true);

					// Second process tries to get exclusive range lock
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(false);
				});

				it('denies when other process holds overlapping exclusive range lock', async () => {
					// First process gets exclusive range lock
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 150n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process tries to get overlapping exclusive range lock
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(false);
				});

				it('denies when other process holds overlapping shared range lock', async () => {
					// First process gets shared range lock
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 50n,
							end: 150n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process tries to get overlapping exclusive range lock
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(false);
				});

				it('allows when other process holds non-overlapping exclusive range lock', async () => {
					// First process gets exclusive range lock
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 50n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process gets non-overlapping exclusive range lock
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 100n,
							end: 150n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});

				it('allows when other process holds non-overlapping shared range lock', async () => {
					// First process gets shared range lock
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0n,
							end: 50n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process gets non-overlapping exclusive range lock
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 100n,
							end: 150n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});

				it('new lock request merges with overlapping locks from same process', async () => {
					// First get an exclusive range lock
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Replace it with a new overlapping lock
					const result2 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 50n,
							end: 150n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);

					// Verify the old lock range is in place by trying to get a lock in that range
					const obtainedExclusiveLockOnOldRange =
						await remoteProcessApi.lockFileByteRange(
							TEST_FILE1,
							{
								type: 'exclusive',
								start: 0n,
								end: 50n,
								pid: 2,
								fd: remoteTestFile1Fd,
							},
							false
						);
					expect(obtainedExclusiveLockOnOldRange).toBe(false);

					// Verify the new lock range is in place by trying to get a lock in that range
					const obtainedExclusiveLockOnNewRange =
						await remoteProcessApi.lockFileByteRange(
							TEST_FILE1,
							{
								type: 'exclusive',
								start: 100n,
								end: 150n,
								pid: 2,
								fd: remoteTestFile1Fd,
							},
							false
						);
					expect(obtainedExclusiveLockOnNewRange).toBe(false);
				});

				it('treats a range with zero length as covering entire remaining range', async () => {
					// First get an exclusive range lock with zero length
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 100n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Try to get a lock in the remaining range
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);

					// Try to get a lock after the zero-length lock
					const result3 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 100n,
							end: 200n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result3).toBe(false);
				});
			});
			describe('shared', () => {
				it('allows when file unlocked', async () => {
					const result = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result).toBe(true);
				});

				it('denies when other process holds exclusive whole-file lock', async () => {
					// First process gets exclusive whole-file lock
					const result1 = lockManager.lockWholeFile(TEST_FILE1, {
						type: 'exclusive',
						pid: 1,
						fd: localTestFile1Fd,
						waitForLock: false,
					});
					expect(result1).toBe(true);

					// Second process tries to get shared range lock
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0n,
							end: 100n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(false);
				});

				it('allows when other process holds shared whole-file lock', async () => {
					// First process gets shared whole-file lock
					const result1 = lockManager.lockWholeFile(TEST_FILE1, {
						type: 'shared',
						pid: 1,
						fd: localTestFile1Fd,
						waitForLock: false,
					});
					expect(result1).toBe(true);

					// Second process gets shared range lock
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0n,
							end: 100n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});

				it('denies when other process holds overlapping exclusive range lock', async () => {
					// First process gets exclusive range lock
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 50n,
							end: 150n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process tries to get overlapping shared range lock
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0n,
							end: 100n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(false);
				});

				it('allows when other process holds overlapping shared range lock', async () => {
					// First process gets shared range lock
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 50n,
							end: 150n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process gets overlapping shared range lock
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0n,
							end: 100n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});

				it('allows when other process holds non-overlapping exclusive range lock', async () => {
					// First process gets exclusive range lock
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 50n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process gets non-overlapping shared range lock
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 100n,
							end: 150n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});

				it('allows when other process holds non-overlapping shared range lock', async () => {
					// First process gets shared range lock
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0n,
							end: 50n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Second process gets non-overlapping shared range lock
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 100n,
							end: 150n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});

				it('new lock request merges with overlapping locks from same process', async () => {
					// First get a shared range lock
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Replace it with a new overlapping lock
					const result2 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 50n,
							end: 150n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);

					// Verify the old lock is gone by trying to get a lock in that range
					const result3 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0n,
							end: 50n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result3).toBe(true);
				});

				it('treats a range with zero length as covering entire remaining range', async () => {
					// First get a shared range lock with zero length
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 100n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Confirm correct starting point by getting an exclusive lock
					// before the start of the "infinite" range.
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);

					// Confirm the rest of the file is already locked by attempting to exclusively lock
					// within a large part of that range
					const result3 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 200n,
							end: BigInt(Number.MAX_SAFE_INTEGER),
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result3).toBe(false);
				});
			});
			describe('unlock', () => {
				it('does not error when range not locked by current process', async () => {
					expect(() =>
						lockManager.lockFileByteRange(
							TEST_FILE1,
							{
								type: 'unlocked',
								start: 0n,
								end: 100n,
								pid: 1,
								fd: localTestFile1Fd,
							},
							false
						)
					).not.toThrow();
				});

				it('unlocks shared lock', async () => {
					// First get a shared range lock
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Unlock it
					lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'unlocked',
							start: 0n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);

					// Verify it's unlocked by getting an exclusive lock
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});

				it('unlocks exclusive lock', async () => {
					// First get an exclusive range lock
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Unlock it
					lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'unlocked',
							start: 0n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);

					// Verify it's unlocked by getting an exclusive lock
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});

				it('leaves locks owned by other processes intact', async () => {
					// First process gets two locks
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 50n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 50n,
							end: 100n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);

					// Unlock the first process's lock
					lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'unlocked',
							start: 0n,
							end: 50n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);

					// Verify second process's lock is still there
					const result3 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 50n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result3).toBe(false);
				});
				it('unlocks tail of owned locked range when that range overlaps head of unlocked range', async () => {
					// Get a lock from 0-100
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Unlock range 50-150 which overlaps tail of existing lock
					lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'unlocked',
							start: 50n,
							end: 150n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);

					// Verify we can now lock 50-100 but not 0-50
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 50n,
							end: 100n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);

					const result3 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 50n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result3).toBe(false);
				});

				it('unlocks head of owned locked range when that range overlaps tail of unlocked range', async () => {
					// Get a lock from 50-150
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 50n,
							end: 150n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Unlock range 0-100 which overlaps head of existing lock
					lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'unlocked',
							start: 0n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);

					// Verify we can now lock 50-100 but not 100-150
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 50n,
							end: 100n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);

					const result3 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 100n,
							end: 150n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result3).toBe(false);
				});

				it('splits locked range when that range completely contains unlocked range', async () => {
					// Get a lock from 0-200
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 200n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Unlock range 50-150 which is contained within existing lock
					lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'unlocked',
							start: 50n,
							end: 150n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);

					// Verify we can now lock 50-150 but not 0-50 or 150-200
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 50n,
							end: 150n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);

					const result3 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 50n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result3).toBe(false);

					const result4 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 150n,
							end: 200n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result4).toBe(false);
				});

				it('treats a range with zero length as covering entire remaining range', async () => {
					// First get a lock with zero length
					const result1 = lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 100n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);
					expect(result1).toBe(true);

					// Unlock it
					lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'unlocked',
							start: 100n,
							end: 100n,
							pid: 1,
							fd: localTestFile1Fd,
						},
						false
					);

					// Verify it's unlocked by getting a lock after that point
					const result2 = await remoteProcessApi.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 100n,
							end: 200n,
							pid: 2,
							fd: remoteTestFile1Fd,
						},
						false
					);
					expect(result2).toBe(true);
				});
			});
		});

		describe.skip('findFirstConflictingByteRangeLock', () => {
			it('should find conflicting exclusive lock with partial overlap', async () => {
				await lockManager.lockFileByteRange(
					TEST_FILE1,
					{
						type: 'exclusive',
						start: 0n,
						end: 100n,
						pid: 1,
						fd: localTestFile1Fd,
					},
					false
				);

				const conflict =
					await lockManager.findFirstConflictingByteRangeLock(
						TEST_FILE1,
						{
							type: 'shared',
							start: 50n,
							end: 150n,
							pid: 2,
							fd: localTestFile1Fd,
						}
					);

				expect(conflict).toBeDefined();
				expect(conflict?.pid).toBe(1);
				expect(conflict?.type).toBe('exclusive');
			});

			it('should return undefined when no conflict exists', async () => {
				await lockManager.lockFileByteRange(
					TEST_FILE1,
					{
						type: 'shared',
						start: 0n,
						end: 100n,
						pid: 1,
						fd: localTestFile1Fd,
					},
					false
				);

				const conflict =
					await lockManager.findFirstConflictingByteRangeLock(
						TEST_FILE1,
						{
							type: 'shared',
							start: 150n,
							end: 250n,
							pid: 2,
							fd: localTestFile1Fd,
						}
					);

				expect(conflict).toBeUndefined();
			});

			it('should handle an exclusive range lock conflict with a shared whole-file lock', async () => {
				// First get an exclusive whole-file lock
				const result1 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 1,
					fd: localTestFile1Fd,
					waitForLock: false,
				});
				expect(result1).toBe(true);

				// Try to get a range lock
				const conflict =
					await lockManager.findFirstConflictingByteRangeLock(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0n,
							end: 100n,
							pid: 2,
							fd: localTestFile1Fd,
						}
					);

				expect(conflict).toEqual({
					type: 'exclusive',
					start: 0n,
					end: 0n,
					pid: -1,
				});
			});

			it('should handle an exclusive range lock conflict with an exclusive whole-file lock', async () => {
				// First get an exclusive whole-file lock
				const result1 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 1,
					fd: localTestFile1Fd,
					waitForLock: false,
				});
				expect(result1).toBe(true);

				// Try to get a range lock
				const conflict =
					await lockManager.findFirstConflictingByteRangeLock(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 2,
							fd: localTestFile1Fd,
						}
					);

				expect(conflict).toEqual({
					type: 'exclusive',
					start: 0n,
					end: 0n,
					pid: -1,
				});
			});

			it('should handle a shared range lock conflict with an exclusive whole-file lock', async () => {
				// First get an exclusive whole-file lock
				const result1 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 1,
					fd: localTestFile1Fd,
					waitForLock: false,
				});
				expect(result1).toBe(true);

				// Try to get a range lock
				const conflict =
					await lockManager.findFirstConflictingByteRangeLock(
						TEST_FILE1,
						{
							type: 'exclusive',
							start: 0n,
							end: 100n,
							pid: 2,
							fd: localTestFile1Fd,
						}
					);

				expect(conflict).toEqual({
					type: 'shared',
					start: 0n,
					end: 0n,
					pid: -1,
				});
			});
		});

		describe('releaseLocksForProcess', () => {
			it('should release all range locks held by a process across multiple ranges', async () => {
				await lockManager.lockFileByteRange(
					TEST_FILE1,
					{
						type: 'exclusive',
						start: 0n,
						end: 100n,
						pid: 1,
						fd: localTestFile1Fd,
					},
					false
				);
				await lockManager.lockFileByteRange(
					TEST_FILE1,
					{
						type: 'exclusive',
						start: 200n,
						end: 300n,
						pid: 1,
						fd: localTestFile1Fd,
					},
					false
				);
				const exclusiveLockAppearsToBeHeld =
					!(await lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0n,
							end: 300n,
							pid: 2,
							fd: localTestFile1Fd,
						},
						false
					));
				expect(exclusiveLockAppearsToBeHeld).toBe(true);

				await lockManager.lockFileByteRange(
					TEST_FILE2,
					{
						type: 'shared',
						start: 50n,
						end: 150n,
						pid: 1,
						fd: localTestFile2Fd,
					},
					false
				);
				const sharedLockAppearsToBeHeld =
					!(await lockManager.lockFileByteRange(
						TEST_FILE2,
						{
							type: 'exclusive',
							start: 0n,
							end: 300n,
							pid: 2,
							fd: localTestFile2Fd,
						},
						false
					));
				expect(sharedLockAppearsToBeHeld).toBe(true);

				await lockManager.releaseLocksForProcess(1);

				// Verify locks are released by trying to acquire conflicting locks
				const exclusiveLockAppearsToBeReleased =
					await lockManager.lockFileByteRange(
						TEST_FILE1,
						{
							type: 'shared',
							start: 0n,
							end: 300n,
							pid: 2,
							fd: localTestFile1Fd,
						},
						false
					);
				const sharedLockAppearsToBeReleased =
					await lockManager.lockFileByteRange(
						TEST_FILE2,
						{
							type: 'exclusive',
							start: 0n,
							end: 200n,
							pid: 2,
							fd: localTestFile2Fd,
						},
						false
					);

				expect(exclusiveLockAppearsToBeReleased).toBe(true);
				expect(sharedLockAppearsToBeReleased).toBe(true);
			});

			it('should release all whole-file locks held by a process', async () => {
				await lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 1,
					fd: localTestFile1Fd,
					waitForLock: false,
				});

				const exclusiveLockAppearsToBeHeld =
					!(await lockManager.lockWholeFile(TEST_FILE1, {
						type: 'shared',
						pid: 2,
						fd: localTestFile1Fd,
						waitForLock: false,
					}));
				expect(exclusiveLockAppearsToBeHeld).toBe(true);

				await lockManager.lockWholeFile(TEST_FILE2, {
					type: 'shared',
					pid: 1,
					fd: localTestFile2Fd,
					waitForLock: false,
				});
				const sharedLockAppearsToBeHeld =
					!(await lockManager.lockWholeFile(TEST_FILE2, {
						type: 'exclusive',
						pid: 2,
						fd: localTestFile2Fd,
						waitForLock: false,
					}));
				expect(sharedLockAppearsToBeHeld).toBe(true);

				await lockManager.releaseLocksForProcess(1);

				const exclusiveLockAppearsToBeReleased =
					await lockManager.lockWholeFile(TEST_FILE1, {
						type: 'shared',
						pid: 2,
						fd: localTestFile1Fd,
						waitForLock: false,
					});
				const sharedLockAppearsToBeReleased =
					await lockManager.lockWholeFile(TEST_FILE2, {
						type: 'exclusive',
						pid: 2,
						fd: localTestFile2Fd,
						waitForLock: false,
					});

				expect(exclusiveLockAppearsToBeReleased).toBe(true);
				expect(sharedLockAppearsToBeReleased).toBe(true);
			});

			it('leaves locks owned by others intact', async () => {
				// First process gets two locks
				await lockManager.lockFileByteRange(
					TEST_FILE1,
					{
						type: 'exclusive',
						start: 0n,
						end: 50n,
						pid: 1,
						fd: localTestFile1Fd,
					},
					false
				);

				await lockManager.lockFileByteRange(
					TEST_FILE1,
					{
						type: 'exclusive',
						start: 50n,
						end: 100n,
						pid: 2,
						fd: localTestFile1Fd,
					},
					false
				);

				// Release first process's locks
				await lockManager.releaseLocksForProcess(1);

				// Verify second process's lock is still there
				const result = await lockManager.lockFileByteRange(
					TEST_FILE1,
					{
						type: 'exclusive',
						start: 50n,
						end: 100n,
						pid: 1,
						fd: localTestFile1Fd,
					},
					false
				);
				expect(result).toBe(false);
			});
		});
	});
}
