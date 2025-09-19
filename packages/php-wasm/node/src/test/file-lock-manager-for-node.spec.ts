import { writeFileSync, unlinkSync } from 'fs';
import { FileLockManagerForNode } from '../lib/file-lock-manager-for-node';
import { fork } from 'child_process';
import type { ChildProcess } from 'child_process';
import { join } from 'path';
import type {
	FileLockManager,
	WholeFileLockOp,
} from '../lib/file-lock-manager';
import { createNodeFsMountHandler, loadNodeRuntime } from '../lib';
import {
	getLoadedRuntime,
	PHP,
	proxyFileSystem,
	SupportedPHPVersions,
} from '@php-wasm/universal';
import type { SupportedPHPVersion } from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';
import { jspi } from 'wasm-feature-detect';
import { flockSync as nativeFlockSync } from 'fs-ext';

const TEST_FILE1 = new URL('test1.txt', import.meta.url).pathname;
const TEST_FILE2 = new URL('test2.txt', import.meta.url).pathname;

describe('FileLockManagerForNode', () => {
	let lockManager: FileLockManagerForNode;

	beforeEach(() => {
		lockManager = new FileLockManagerForNode(nativeFlockSync);
		writeFileSync(TEST_FILE1, `test file 1 for ${import.meta.url}`);
		writeFileSync(TEST_FILE2, `test file 2 for ${import.meta.url}`);
	});

	afterEach(() => {
		unlinkSync(TEST_FILE1);
		unlinkSync(TEST_FILE2);
	});

	describe('lockWholeFile', () => {
		describe('exclusive', () => {
			it('allows when unlocked', async () => {
				const result = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 1,
					fd: 1,
				});
				expect(result).toBe(true);
			});

			it('allows when the process already holds a lock with the same file descriptor', async () => {
				const requestedLock: WholeFileLockOp = {
					type: 'exclusive',
					pid: 1,
					fd: 1,
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
			});

			it('denies when only whole-file locked by same process with different file descriptor', async () => {
				// First lock
				const result1 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second lock by same process
				const result2 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 1,
					fd: 2,
				});
				expect(result2).toBe(false);
			});

			it('denies when byte-range locked by same process', async () => {
				// First get a byte range lock
				const result1 = await lockManager.lockFileByteRange(
					TEST_FILE1,
					{
						type: 'exclusive',
						start: 0n,
						end: 100n,
						pid: 1,
					}
				);
				expect(result1).toBe(true);

				// Try to get whole file lock with same pid
				const result2 = await lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 1,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('denies when other process holds exclusive whole-file lock', async () => {
				// First process locks
				const result1 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to lock
				const result2 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('denies when other process holds shared whole-file lock', async () => {
				// First process gets shared lock
				const result1 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get exclusive lock
				const result2 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('denies when other process holds exclusive range lock', async () => {
				// First process gets exclusive range lock
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get exclusive whole-file lock
				const result2 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('denies when other process holds shared range lock', async () => {
				// First process gets shared range lock
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get exclusive whole-file lock
				const result2 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});
		});
		describe('shared', () => {
			it('allows when unlocked', async () => {
				const result = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 1,
					fd: 1,
				});
				expect(result).toBe(true);
			});

			it('allows when only whole-file locked by same process', async () => {
				// First lock
				const result1 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second lock by same process
				const result2 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 1,
					fd: 2,
				});
				expect(result2).toBe(true);
			});

			it('denies when only exclusively byte-range locked by same process', async () => {
				// First get a byte range lock
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Same process tries to get shared whole-file lock
				const result2 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 1,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('denies when other process holds exclusive whole-file lock', async () => {
				// First process gets exclusive lock
				const result1 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get shared lock
				const result2 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('allows when same process holds shared whole-file lock', async () => {
				// First process gets shared lock
				const result1 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process gets shared lock
				const result2 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 1,
					fd: 1,
				});
				expect(result2).toBe(true);
			});

			it('allows when other process holds shared whole-file lock', async () => {
				// First process gets shared lock
				const result1 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process gets shared lock
				const result2 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(true);
			});

			it('denies when other process holds exclusive range lock', async () => {
				// First process gets exclusive range lock
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get shared whole-file lock
				const result2 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('allows when other process holds shared range lock', async () => {
				// First process gets shared range lock
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Second process gets shared whole-file lock
				const result2 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(true);
			});
		});
		describe('unlock', () => {
			it('does not error when file already unlocked', async () => {
				const result = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'unlock',
					pid: 1,
					fd: 1,
				});
				expect(result).toBe(true);
			});

			it('unlocks shared lock for matching process', async () => {
				// First get a shared lock
				const result1 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Unlock it
				lockManager.lockWholeFile(TEST_FILE1, {
					type: 'unlock',
					pid: 1,
					fd: 1,
				});

				// Verify it's unlocked by getting an exclusive lock for another process
				const result2 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(true);
			});

			it('unlocks exclusive lock for matching process', async () => {
				// First get an exclusive lock
				const result1 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Unlock it
				const result2 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'unlock',
					pid: 1,
					fd: 1,
				});
				expect(result2).toBe(true);

				// Verify it's unlocked by getting an exclusive lock
				const result3 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 2,
					fd: 1,
				});
				expect(result3).toBe(true);
			});
		});
	});

	describe('lockFileByteRange', () => {
		describe('exclusive', () => {
			it('allows when file unlocked', async () => {
				const result = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 1,
				});
				expect(result).toBe(true);
			});

			it('denies when other process holds exclusive whole-file lock', async () => {
				// First process gets exclusive whole-file lock
				const result1 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get exclusive range lock
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 2,
				});
				expect(result2).toBe(false);
			});

			it('denies when other process holds shared whole-file lock', async () => {
				// First process gets shared whole-file lock
				const result1 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get exclusive range lock
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 2,
				});
				expect(result2).toBe(false);
			});

			it('denies when other process holds overlapping exclusive range lock', async () => {
				// First process gets exclusive range lock
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 150n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get overlapping exclusive range lock
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 2,
				});
				expect(result2).toBe(false);
			});

			it('denies when other process holds overlapping shared range lock', async () => {
				// First process gets shared range lock
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 50n,
					end: 150n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get overlapping exclusive range lock
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 2,
				});
				expect(result2).toBe(false);
			});

			it('allows when other process holds non-overlapping exclusive range lock', async () => {
				// First process gets exclusive range lock
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 50n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Second process gets non-overlapping exclusive range lock
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 100n,
					end: 150n,
					pid: 2,
				});
				expect(result2).toBe(true);
			});

			it('allows when other process holds non-overlapping shared range lock', async () => {
				// First process gets shared range lock
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 0n,
					end: 50n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Second process gets non-overlapping exclusive range lock
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 100n,
					end: 150n,
					pid: 2,
				});
				expect(result2).toBe(true);
			});

			it('new lock request merges with overlapping locks from same process', async () => {
				// First get an exclusive range lock
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Replace it with a new overlapping lock
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 50n,
					end: 150n,
					pid: 1,
				});
				expect(result2).toBe(true);

				// Verify the old lock range is in place by trying to get a lock in that range
				const obtainedExclusiveLockOnOldRange =
					lockManager.lockFileByteRange(TEST_FILE1, {
						type: 'exclusive',
						start: 0n,
						end: 50n,
						pid: 2,
					});
				expect(obtainedExclusiveLockOnOldRange).toBe(false);

				// Verify the new lock range is in place by trying to get a lock in that range
				const obtainedExclusiveLockOnNewRange =
					lockManager.lockFileByteRange(TEST_FILE1, {
						type: 'exclusive',
						start: 100n,
						end: 150n,
						pid: 2,
					});
				expect(obtainedExclusiveLockOnNewRange).toBe(false);
			});

			it('treats a range with zero length as covering entire remaining range', async () => {
				// First get an exclusive range lock with zero length
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 100n,
					end: 100n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Try to get a lock in the remaining range
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 2,
				});
				expect(result2).toBe(true);

				// Try to get a lock after the zero-length lock
				const result3 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 100n,
					end: 200n,
					pid: 2,
				});
				expect(result3).toBe(false);
			});
		});
		describe('shared', () => {
			it('allows when file unlocked', async () => {
				const result = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 1,
				});
				expect(result).toBe(true);
			});

			it('denies when other process holds exclusive whole-file lock', async () => {
				// First process gets exclusive whole-file lock
				const result1 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'exclusive',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get shared range lock
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 2,
				});
				expect(result2).toBe(false);
			});

			it('allows when other process holds shared whole-file lock', async () => {
				// First process gets shared whole-file lock
				const result1 = lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process gets shared range lock
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 2,
				});
				expect(result2).toBe(true);
			});

			it('denies when other process holds overlapping exclusive range lock', async () => {
				// First process gets exclusive range lock
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 50n,
					end: 150n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get overlapping shared range lock
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 2,
				});
				expect(result2).toBe(false);
			});

			it('allows when other process holds overlapping shared range lock', async () => {
				// First process gets shared range lock
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 50n,
					end: 150n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Second process gets overlapping shared range lock
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 2,
				});
				expect(result2).toBe(true);
			});

			it('allows when other process holds non-overlapping exclusive range lock', async () => {
				// First process gets exclusive range lock
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 50n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Second process gets non-overlapping shared range lock
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 100n,
					end: 150n,
					pid: 2,
				});
				expect(result2).toBe(true);
			});

			it('allows when other process holds non-overlapping shared range lock', async () => {
				// First process gets shared range lock
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 0n,
					end: 50n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Second process gets non-overlapping shared range lock
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 100n,
					end: 150n,
					pid: 2,
				});
				expect(result2).toBe(true);
			});

			it('new lock request merges with overlapping locks from same process', async () => {
				// First get a shared range lock
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Replace it with a new overlapping lock
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 50n,
					end: 150n,
					pid: 1,
				});
				expect(result2).toBe(true);

				// Verify the old lock is gone by trying to get a lock in that range
				const result3 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 0n,
					end: 50n,
					pid: 2,
				});
				expect(result3).toBe(true);
			});

			it('treats a range with zero length as covering entire remaining range', async () => {
				// First get a shared range lock with zero length
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 100n,
					end: 100n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Confirm correct starting point by getting an exclusive lock
				// before the start of the "infinite" range.
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 2,
				});
				expect(result2).toBe(true);

				// Confirm the rest of the file is already locked by attempting to exclusively lock
				// within a large part of that range
				const result3 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 200n,
					end: BigInt(Number.MAX_SAFE_INTEGER),
					pid: 2,
				});
				expect(result3).toBe(false);
			});
		});
		describe('unlock', () => {
			it('does not error when range not locked by current process', async () => {
				expect(() =>
					lockManager.lockFileByteRange(TEST_FILE1, {
						type: 'unlocked',
						start: 0n,
						end: 100n,
						pid: 1,
					})
				).not.toThrow();
			});

			it('unlocks shared lock', async () => {
				// First get a shared range lock
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Unlock it
				lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'unlocked',
					start: 0n,
					end: 100n,
					pid: 1,
				});

				// Verify it's unlocked by getting an exclusive lock
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 2,
				});
				expect(result2).toBe(true);
			});

			it('unlocks exclusive lock', async () => {
				// First get an exclusive range lock
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Unlock it
				lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'unlocked',
					start: 0n,
					end: 100n,
					pid: 1,
				});

				// Verify it's unlocked by getting an exclusive lock
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 2,
				});
				expect(result2).toBe(true);
			});

			it('leaves locks owned by other processes intact', async () => {
				// First process gets two locks
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 50n,
					pid: 1,
				});
				expect(result1).toBe(true);

				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 50n,
					end: 100n,
					pid: 2,
				});
				expect(result2).toBe(true);

				// Unlock the first process's lock
				lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'unlocked',
					start: 0n,
					end: 50n,
					pid: 1,
				});

				// Verify second process's lock is still there
				const result3 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 50n,
					end: 100n,
					pid: 1,
				});
				expect(result3).toBe(false);
			});
			it('unlocks tail of owned locked range when that range overlaps head of unlocked range', async () => {
				// Get a lock from 0-100
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Unlock range 50-150 which overlaps tail of existing lock
				lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'unlocked',
					start: 50n,
					end: 150n,
					pid: 1,
				});

				// Verify we can now lock 50-100 but not 0-50
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 50n,
					end: 100n,
					pid: 2,
				});
				expect(result2).toBe(true);

				const result3 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 50n,
					pid: 2,
				});
				expect(result3).toBe(false);
			});

			it('unlocks head of owned locked range when that range overlaps tail of unlocked range', async () => {
				// Get a lock from 50-150
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 50n,
					end: 150n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Unlock range 0-100 which overlaps head of existing lock
				lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'unlocked',
					start: 0n,
					end: 100n,
					pid: 1,
				});

				// Verify we can now lock 50-100 but not 100-150
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 50n,
					end: 100n,
					pid: 2,
				});
				expect(result2).toBe(true);

				const result3 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 100n,
					end: 150n,
					pid: 2,
				});
				expect(result3).toBe(false);
			});

			it('splits locked range when that range completely contains unlocked range', async () => {
				// Get a lock from 0-200
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 200n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Unlock range 50-150 which is contained within existing lock
				lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'unlocked',
					start: 50n,
					end: 150n,
					pid: 1,
				});

				// Verify we can now lock 50-150 but not 0-50 or 150-200
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 50n,
					end: 150n,
					pid: 2,
				});
				expect(result2).toBe(true);

				const result3 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 0n,
					end: 50n,
					pid: 2,
				});
				expect(result3).toBe(false);

				const result4 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 150n,
					end: 200n,
					pid: 2,
				});
				expect(result4).toBe(false);
			});

			it('treats a range with zero length as covering entire remaining range', async () => {
				// First get a lock with zero length
				const result1 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 100n,
					end: 100n,
					pid: 1,
				});
				expect(result1).toBe(true);

				// Unlock it
				lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'unlocked',
					start: 100n,
					end: 100n,
					pid: 1,
				});

				// Verify it's unlocked by getting a lock after that point
				const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'exclusive',
					start: 100n,
					end: 200n,
					pid: 2,
				});
				expect(result2).toBe(true);
			});
		});
	});

	describe('findFirstConflictingByteRangeLock', () => {
		it('should find conflicting exclusive lock with partial overlap', async () => {
			await lockManager.lockFileByteRange(TEST_FILE1, {
				type: 'exclusive',
				start: 0n,
				end: 100n,
				pid: 1,
			});

			const conflict =
				await lockManager.findFirstConflictingByteRangeLock(
					TEST_FILE1,
					{
						type: 'shared',
						start: 50n,
						end: 150n,
						pid: 2,
					}
				);

			expect(conflict).toBeDefined();
			expect(conflict?.pid).toBe(1);
			expect(conflict?.type).toBe('exclusive');
		});

		it('should return undefined when no conflict exists', async () => {
			await lockManager.lockFileByteRange(TEST_FILE1, {
				type: 'shared',
				start: 0n,
				end: 100n,
				pid: 1,
			});

			const conflict =
				await lockManager.findFirstConflictingByteRangeLock(
					TEST_FILE1,
					{
						type: 'shared',
						start: 150n,
						end: 250n,
						pid: 2,
					}
				);

			expect(conflict).toBeUndefined();
		});

		it('should handle an exclusive range lock conflict with a shared whole-file lock', async () => {
			// First get an exclusive whole-file lock
			const result1 = lockManager.lockWholeFile(TEST_FILE1, {
				type: 'exclusive',
				pid: 1,
				fd: 1,
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
				fd: 1,
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
				fd: 1,
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
			await lockManager.lockFileByteRange(TEST_FILE1, {
				type: 'exclusive',
				start: 0n,
				end: 100n,
				pid: 1,
			});
			await lockManager.lockFileByteRange(TEST_FILE1, {
				type: 'exclusive',
				start: 200n,
				end: 300n,
				pid: 1,
			});
			const exclusiveLockAppearsToBeHeld =
				!(await lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 0n,
					end: 300n,
					pid: 2,
				}));
			expect(exclusiveLockAppearsToBeHeld).toBe(true);

			await lockManager.lockFileByteRange(TEST_FILE2, {
				type: 'shared',
				start: 50n,
				end: 150n,
				pid: 1,
			});
			const sharedLockAppearsToBeHeld =
				!(await lockManager.lockFileByteRange(TEST_FILE2, {
					type: 'exclusive',
					start: 0n,
					end: 300n,
					pid: 2,
				}));
			expect(sharedLockAppearsToBeHeld).toBe(true);

			await lockManager.releaseLocksForProcess(1);

			// Verify locks are released by trying to acquire conflicting locks
			const exclusiveLockAppearsToBeReleased =
				await lockManager.lockFileByteRange(TEST_FILE1, {
					type: 'shared',
					start: 0n,
					end: 300n,
					pid: 2,
				});
			const sharedLockAppearsToBeReleased =
				await lockManager.lockFileByteRange(TEST_FILE2, {
					type: 'exclusive',
					start: 0n,
					end: 200n,
					pid: 2,
				});

			expect(exclusiveLockAppearsToBeReleased).toBe(true);
			expect(sharedLockAppearsToBeReleased).toBe(true);
		});

		it('should release all whole-file locks held by a process', async () => {
			await lockManager.lockWholeFile(TEST_FILE1, {
				type: 'exclusive',
				pid: 1,
				fd: 1,
			});

			const exclusiveLockAppearsToBeHeld =
				!(await lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 2,
					fd: 1,
				}));
			expect(exclusiveLockAppearsToBeHeld).toBe(true);

			await lockManager.lockWholeFile(TEST_FILE2, {
				type: 'shared',
				pid: 1,
				fd: 1,
			});
			const sharedLockAppearsToBeHeld = !(await lockManager.lockWholeFile(
				TEST_FILE2,
				{
					type: 'exclusive',
					pid: 2,
					fd: 1,
				}
			));
			expect(sharedLockAppearsToBeHeld).toBe(true);

			await lockManager.releaseLocksForProcess(1);

			const exclusiveLockAppearsToBeReleased =
				await lockManager.lockWholeFile(TEST_FILE1, {
					type: 'shared',
					pid: 2,
					fd: 1,
				});
			const sharedLockAppearsToBeReleased =
				await lockManager.lockWholeFile(TEST_FILE2, {
					type: 'exclusive',
					pid: 2,
					fd: 1,
				});

			expect(exclusiveLockAppearsToBeReleased).toBe(true);
			expect(sharedLockAppearsToBeReleased).toBe(true);
		});

		it('leaves locks owned by others intact', async () => {
			// First process gets two locks
			await lockManager.lockFileByteRange(TEST_FILE1, {
				type: 'exclusive',
				start: 0n,
				end: 50n,
				pid: 1,
			});

			await lockManager.lockFileByteRange(TEST_FILE1, {
				type: 'exclusive',
				start: 50n,
				end: 100n,
				pid: 2,
			});

			// Release first process's locks
			await lockManager.releaseLocksForProcess(1);

			// Verify second process's lock is still there
			const result = await lockManager.lockFileByteRange(TEST_FILE1, {
				type: 'exclusive',
				start: 50n,
				end: 100n,
				pid: 1,
			});
			expect(result).toBe(false);
		});
	});

	describe('integration with native OS file locking', () => {
		let childProcess: ChildProcess | undefined;

		afterEach(async () => {
			if (childProcess) {
				await killProcess(childProcess);
				childProcess = undefined;
			}
		});

		it('cannot acquire exclusive lock when native exclusive lock exists', async () => {
			// Child process gets native exclusive lock
			const result1 = await spawnLockProcess(TEST_FILE1, 'exclusive');
			expect(result1).toEqual({
				success: true,
				child: expect.any(Object),
			});
			childProcess = result1.child;

			// Try to get exclusive lock through lock manager
			const result2 = lockManager.lockWholeFile(TEST_FILE1, {
				type: 'exclusive',
				pid: 1,
				fd: 1,
			});
			expect(result2).toBe(false);
		});

		it('cannot acquire shared lock when native exclusive lock exists', async () => {
			// Child process gets native exclusive lock
			const result1 = await spawnLockProcess(TEST_FILE1, 'exclusive');
			expect(result1).toEqual({
				success: true,
				child: expect.any(Object),
			});
			childProcess = result1.child;

			// Try to get shared lock through lock manager
			const result2 = lockManager.lockWholeFile(TEST_FILE1, {
				type: 'shared',
				pid: 1,
				fd: 1,
			});
			expect(result2).toBe(false);
		});

		it('can acquire shared lock when native shared lock exists', async () => {
			// Child process gets native shared lock
			const result1 = await spawnLockProcess(TEST_FILE1, 'shared');
			expect(result1).toEqual({
				success: true,
				child: expect.any(Object),
			});
			childProcess = result1.child;

			// Try to get shared lock through lock manager
			const result2 = lockManager.lockWholeFile(TEST_FILE1, {
				type: 'shared',
				pid: 1,
				fd: 1,
			});
			expect(result2).toBe(true);
		});

		it('cannot acquire exclusive lock when native shared lock exists', async () => {
			// Child process gets native shared lock
			const result1 = await spawnLockProcess(TEST_FILE1, 'shared');
			expect(result1).toEqual({
				success: true,
				child: expect.any(Object),
			});
			childProcess = result1.child;

			// Try to get exclusive lock through lock manager
			const result2 = lockManager.lockWholeFile(TEST_FILE1, {
				type: 'exclusive',
				pid: 1,
				fd: 1,
			});
			expect(result2).toBe(false);
		});

		it('cannot acquire exclusive range lock when native exclusive lock exists', async () => {
			// Child process gets native exclusive lock
			const result1 = await spawnLockProcess(TEST_FILE1, 'exclusive');
			expect(result1).toEqual({
				success: true,
				child: expect.any(Object),
			});
			childProcess = result1.child;

			// Try to get exclusive range lock through lock manager
			const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
				type: 'exclusive',
				start: 0n,
				end: 100n,
				pid: 1,
			});
			expect(result2).toBe(false);
		});

		it('cannot acquire shared range lock when native exclusive lock exists', async () => {
			// Child process gets native exclusive lock
			const result1 = await spawnLockProcess(TEST_FILE1, 'exclusive');
			expect(result1).toEqual({
				success: true,
				child: expect.any(Object),
			});
			childProcess = result1.child;

			// Try to get shared range lock through lock manager
			const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
				type: 'shared',
				start: 0n,
				end: 100n,
				pid: 1,
			});
			expect(result2).toBe(false);
		});

		it('can acquire shared range lock when native shared lock exists', async () => {
			// Child process gets native shared lock
			const result1 = await spawnLockProcess(TEST_FILE1, 'shared');
			expect(result1).toEqual({
				success: true,
				child: expect.any(Object),
			});
			childProcess = result1.child;

			// Try to get shared range lock through lock manager
			const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
				type: 'shared',
				start: 0n,
				end: 100n,
				pid: 1,
			});
			expect(result2).toBe(true);
		});

		it('cannot acquire exclusive range lock when native shared lock exists', async () => {
			// Child process gets native shared lock
			const result1 = await spawnLockProcess(TEST_FILE1, 'shared');
			expect(result1).toEqual({
				success: true,
				child: expect.any(Object),
			});
			childProcess = result1.child;

			// Try to get exclusive range lock through lock manager
			const result2 = lockManager.lockFileByteRange(TEST_FILE1, {
				type: 'exclusive',
				start: 0n,
				end: 100n,
				pid: 1,
			});
			expect(result2).toBe(false);
		});

		// Helper function to spawn a child process that will attempt to acquire a lock
		function spawnLockProcess(
			filePath: string,
			lockType: 'exclusive' | 'shared'
		): Promise<{ success: boolean; error?: string; child?: ChildProcess }> {
			return new Promise((resolve) => {
				const child = fork(join(__dirname, 'file-lock-test-worker.js'));

				child.on(
					'message',
					(message: {
						type: 'success' | 'error';
						fd?: number;
						error?: string;
					}) => {
						if (message.type === 'success') {
							resolve({ success: true, child });
						} else {
							resolve({
								success: false,
								error: message.error,
								child,
							});
						}
					}
				);

				child.on('error', (error) => {
					resolve({ success: false, error: error.message, child });
				});

				child.send({ type: 'acquire', filePath, lockType });
			});
		}

		// Helper function to kill a process
		async function killProcess(child: ChildProcess): Promise<void> {
			return new Promise((resolve) => {
				child.send({ type: 'release' });
				// Give the process a moment to clean up
				child.on('exit', resolve);
			});
		}
	});

	const phpVersionsToTest =
		'PHP' in process.env
			? [process.env['PHP'] as SupportedPHPVersion]
			: SupportedPHPVersions;

	phpVersionsToTest.forEach((phpVersion) => {
		describe(`PHP ${phpVersion}: integration with primary and secondary runtimes`, async () => {
			const mockFnWithResult = (await jspi())
				? // Use async mocks for JSPI to match the async FileLockManager
				  // used by JSPI PHP builds.
				  (value: any) => vi.fn().mockResolvedValue(value)
				: (value: any) => vi.fn().mockReturnValue(value);

			function createMockFileLockManager(): FileLockManager {
				return {
					lockWholeFile: mockFnWithResult(true),
					lockFileByteRange: mockFnWithResult(true),
					findFirstConflictingByteRangeLock:
						mockFnWithResult(undefined),
					releaseLocksForProcessFd: mockFnWithResult(undefined),
					releaseLocksForProcess: mockFnWithResult(undefined),
				};
			}

			// TODO: Add tests for fcntl()

			test(`should attempt to lock a NODEFS file and a PROXYFS node that wraps a NODEFS file`, async () => {
				// NOTE: Normally, we would use a single file lock manager across all runtimes,
				// but to keep state clearer within this test, we use a separate manager per runtime.
				const fileLockManagerForRuntime1 = createMockFileLockManager();
				const ENV = { DOCROOT: '/wordpress' };
				const php1 = new PHP(
					await loadNodeRuntime(phpVersion, {
						emscriptenOptions: {
							ENV,
							fileLockManager: fileLockManagerForRuntime1,
						},
					})
				);
				const realPathToMount = joinPaths(
					import.meta.dirname,
					'test-data',
					'file-lock-test'
				);
				php1.mount(
					'/wordpress',
					createNodeFsMountHandler(realPathToMount)
				);
				const realPathToLock = joinPaths(
					realPathToMount,
					'wp-content',
					'lock-this.txt'
				);
				const vfsPathToLock = '/wordpress/wp-content/lock-this.txt';
				const phpThatAttemptsToLock = `<?php
				$f = fopen('${vfsPathToLock}', 'w');
				flock($f, LOCK_EX);
				`;
				const result1 = await php1.runStream({
					code: phpThatAttemptsToLock,
				});
				expect(await result1.exitCode).toBe(0);
				expect(
					fileLockManagerForRuntime1.lockWholeFile,
					'locking NODEFS file'
				).toHaveBeenCalledWith(
					realPathToLock,
					expect.objectContaining({ type: 'exclusive' })
				);

				const fileLockManagerForRuntime2 = createMockFileLockManager();
				const php2 = new PHP(
					await loadNodeRuntime(phpVersion, {
						emscriptenOptions: {
							ENV,
							fileLockManager: fileLockManagerForRuntime2,
							trace: (...args: any[]) => console.error(...args),
						},
					})
				);
				proxyFileSystem(php1, php2, ['/wordpress']);
				const result2 = await php2.runStream({
					code: phpThatAttemptsToLock,
				});
				expect(await result2.exitCode).toBe(0);
				expect(
					fileLockManagerForRuntime2.lockWholeFile,
					'locking NODEFS file via PROXYFS'
				).toHaveBeenCalledWith(
					realPathToLock,
					expect.objectContaining({ type: 'exclusive' })
				);
			});

			test(`should not attempt to lock a MEMFS file or a PROXYFS node that wraps a MEMFS file`, async () => {
				// NOTE: Normally, we would use a single file lock manager across all runtimes,
				// but to keep state clearer within this test, we use a separate manager per runtime.
				const fileLockManagerForRuntime1 = createMockFileLockManager();
				const ENV = { DOCROOT: '/wordpress' };
				const php1 = new PHP(
					await loadNodeRuntime(phpVersion, {
						emscriptenOptions: {
							ENV,
							fileLockManager: fileLockManagerForRuntime1,
						},
					})
				);
				php1.mkdir('/wordpress/wp-content');
				const pathNotToLock =
					'/wordpress/wp-content/do-not-lock-this.txt';
				php1.writeFile(pathNotToLock, new Uint8Array(0));
				const phpThatAttemptsToLock = `<?php
					$f = fopen('${pathNotToLock}', 'w');
					// Explicitly fail so this test does not pass by accident
					// if the PHP fails to open the file and tolerates the error.
					if ($f === false) {
						throw new Error('Failed to open file');
					}
					flock($f, LOCK_EX);
					`;
				const result1 = await php1.runStream({
					code: phpThatAttemptsToLock,
				});
				expect(await result1.exitCode).toBe(0);
				expect(
					fileLockManagerForRuntime1.lockWholeFile
				).not.toHaveBeenCalled();

				const fileLockManagerForRuntime2 = createMockFileLockManager();
				const php2 = new PHP(
					await loadNodeRuntime(phpVersion, {
						emscriptenOptions: {
							ENV,
							fileLockManager: fileLockManagerForRuntime2,
						},
					})
				);
				proxyFileSystem(php1, php2, ['/wordpress']);
				const result2 = await php2.runStream({
					code: phpThatAttemptsToLock,
				});
				expect(await result2.exitCode).toBe(0);
				expect(
					fileLockManagerForRuntime2.lockWholeFile
				).not.toHaveBeenCalled();
			});

			test(`regression test for https://github.com/WordPress/wordpress-playground/pull/2300`, async () => {
				const opts = {
					emscriptenOptions: { ENV: { DOCROOT: '/wordpress' } },
				};
				const runtime1 = getLoadedRuntime(
					await loadNodeRuntime('8.3', opts)
				);
				runtime1.FS.mkdir('/wordpress');

				const runtime2 = getLoadedRuntime(
					await loadNodeRuntime('8.3', opts)
				);
				runtime2.FS.mkdir('/wordpress');

				runtime2.FS.mount(
					runtime2.PROXYFS,
					{ root: '/wordpress', fs: runtime1.FS },
					'/wordpress'
				);

				// This worked:
				// runtime1.FS.mkdir('/wordpress/wp-content');

				// Prior to a fix, this did not:
				expect(() =>
					runtime2.FS.mkdir('/wordpress/wp-content')
				).not.toThrow();
			});
		});
	});
});
