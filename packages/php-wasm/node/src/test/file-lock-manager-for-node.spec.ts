import { FileLockManagerForNode } from '../lib/file-lock-manager-for-node';

// TODO: These tests are AI-generated and totally unreviewed so far. Review these tests with a critical eye before merging.
describe('FileLockManagerForNode', () => {
	let lockManager: FileLockManagerForNode;

	beforeEach(() => {
		lockManager = new FileLockManagerForNode();
	});

	describe('lockWholeFile', () => {
		describe('exclusive', () => {
			it('allows when file unlocked', async () => {
				const result = lockManager.lockWholeFile('/test.txt', {
					type: 'exclusive',
					pid: 1,
					fd: 1,
				});
				expect(result).toBe(true);
			});

			it('allows when file only whole-file locked by same process', async () => {
				// First lock
				const result1 = lockManager.lockWholeFile('/test.txt', {
					type: 'exclusive',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second lock by same process
				const result2 = lockManager.lockWholeFile('/test.txt', {
					type: 'exclusive',
					pid: 1,
					fd: 2,
				});
				expect(result2).toBe(true);
			});

			it('allows when file only byte-range locked by same process', async () => {
				// TODO: Implement
			});

			it('denies when other process holds exclusive whole-file lock', async () => {
				// First process locks
				const result1 = lockManager.lockWholeFile('/test.txt', {
					type: 'exclusive',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to lock
				const result2 = lockManager.lockWholeFile('/test.txt', {
					type: 'exclusive',
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('denies when other process holds shared whole-file lock', async () => {
				// First process gets shared lock
				const result1 = lockManager.lockWholeFile('/test.txt', {
					type: 'shared',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get exclusive lock
				const result2 = lockManager.lockWholeFile('/test.txt', {
					type: 'exclusive',
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('denies when other process holds exclusive range lock', async () => {
				// First process gets exclusive range lock
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get exclusive whole-file lock
				const result2 = lockManager.lockWholeFile('/test.txt', {
					type: 'exclusive',
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('denies when other process holds shared range lock', async () => {
				// First process gets shared range lock
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get exclusive whole-file lock
				const result2 = lockManager.lockWholeFile('/test.txt', {
					type: 'exclusive',
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});
		});
		describe('shared', () => {
			it('allows when file unlocked', async () => {
				const result = lockManager.lockWholeFile('/test.txt', {
					type: 'shared',
					pid: 1,
					fd: 1,
				});
				expect(result).toBe(true);
			});

			it('allows when file only whole-file locked by same process', async () => {
				// First lock
				const result1 = lockManager.lockWholeFile('/test.txt', {
					type: 'shared',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second lock by same process
				const result2 = lockManager.lockWholeFile('/test.txt', {
					type: 'shared',
					pid: 1,
					fd: 2,
				});
				expect(result2).toBe(true);
			});

			it('allows when file only byte-range locked by same process', async () => {
				// TODO: Implement
			});

			it('denies when other process holds exclusive whole-file lock', async () => {
				// First process gets exclusive lock
				const result1 = lockManager.lockWholeFile('/test.txt', {
					type: 'exclusive',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get shared lock
				const result2 = lockManager.lockWholeFile('/test.txt', {
					type: 'shared',
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('allows when other process holds shared whole-file lock', async () => {
				// First process gets shared lock
				const result1 = lockManager.lockWholeFile('/test.txt', {
					type: 'shared',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process gets shared lock
				const result2 = lockManager.lockWholeFile('/test.txt', {
					type: 'shared',
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(true);
			});

			it('denies when other process holds exclusive range lock', async () => {
				// First process gets exclusive range lock
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get shared whole-file lock
				const result2 = lockManager.lockWholeFile('/test.txt', {
					type: 'shared',
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('allows when other process holds shared range lock', async () => {
				// First process gets shared range lock
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process gets shared whole-file lock
				const result2 = lockManager.lockWholeFile('/test.txt', {
					type: 'shared',
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(true);
			});
		});
		describe('unlock', () => {
			it('does not error when file already unlocked', async () => {
				const result = lockManager.lockWholeFile('/test.txt', {
					type: 'unlock',
					pid: 1,
					fd: 1,
				});
				expect(result).toBe(true);
			});

			it('unlocks shared lock for matching process', async () => {
				// First get a shared lock
				const result1 = lockManager.lockWholeFile('/test.txt', {
					type: 'shared',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Unlock it
				const result2 = lockManager.lockWholeFile('/test.txt', {
					type: 'unlock',
					pid: 1,
					fd: 1,
				});
				expect(result2).toBe(true);

				// Verify it's unlocked by getting an exclusive lock
				const result3 = lockManager.lockWholeFile('/test.txt', {
					type: 'exclusive',
					pid: 2,
					fd: 1,
				});
				expect(result3).toBe(true);
			});

			it('unlocks exclusive lock for matching process', async () => {
				// First get an exclusive lock
				const result1 = lockManager.lockWholeFile('/test.txt', {
					type: 'exclusive',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Unlock it
				const result2 = lockManager.lockWholeFile('/test.txt', {
					type: 'unlock',
					pid: 1,
					fd: 1,
				});
				expect(result2).toBe(true);

				// Verify it's unlocked by getting an exclusive lock
				const result3 = lockManager.lockWholeFile('/test.txt', {
					type: 'exclusive',
					pid: 2,
					fd: 1,
				});
				expect(result3).toBe(true);
			});

			it('releases native file lock when no locks remain', async () => {
				// First get an exclusive lock
				const result1 = lockManager.lockWholeFile('/test.txt', {
					type: 'exclusive',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Unlock it
				const result2 = lockManager.lockWholeFile('/test.txt', {
					type: 'unlock',
					pid: 1,
					fd: 1,
				});
				expect(result2).toBe(true);

				// Verify the file is completely unlocked by getting a new lock
				const result3 = lockManager.lockWholeFile('/test.txt', {
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
				const result = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 1,
					fd: 1,
				});
				expect(result).toBe(true);
			});

			it('denies when other process holds exclusive whole-file lock', async () => {
				// First process gets exclusive whole-file lock
				const result1 = lockManager.lockWholeFile('/test.txt', {
					type: 'exclusive',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get exclusive range lock
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('denies when other process holds shared whole-file lock', async () => {
				// First process gets shared whole-file lock
				const result1 = lockManager.lockWholeFile('/test.txt', {
					type: 'shared',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get exclusive range lock
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('denies when other process holds overlapping exclusive range lock', async () => {
				// First process gets exclusive range lock
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 50n,
					end: 150n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get overlapping exclusive range lock
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('denies when other process holds overlapping shared range lock', async () => {
				// First process gets shared range lock
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 50n,
					end: 150n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get overlapping exclusive range lock
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('allows when other process holds non-overlapping exclusive range lock', async () => {
				// First process gets exclusive range lock
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 0n,
					end: 50n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process gets non-overlapping exclusive range lock
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 100n,
					end: 150n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(true);
			});

			it('allows when other process holds non-overlapping shared range lock', async () => {
				// First process gets shared range lock
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 0n,
					end: 50n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process gets non-overlapping exclusive range lock
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 100n,
					end: 150n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(true);
			});

			it('new lock request merges with overlapping locks from same process', async () => {
				// First get an exclusive range lock
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Replace it with a new overlapping lock
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 50n,
					end: 150n,
					pid: 1,
					fd: 1,
				});
				expect(result2).toBe(true);

				// Verify the old lock is gone by trying to get a lock in that range
				const result3 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 0n,
					end: 50n,
					pid: 2,
					fd: 1,
				});
				expect(result3).toBe(true);
			});

			it('treats a range with zero length as covering entire remaining range', async () => {
				// First get an exclusive range lock with zero length
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 100n,
					end: 100n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Try to get a lock in the remaining range
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(true);

				// Try to get a lock after the zero-length lock
				const result3 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 100n,
					end: 200n,
					pid: 2,
					fd: 1,
				});
				expect(result3).toBe(false);
			});
		});
		describe('shared', () => {
			it('allows when file unlocked', async () => {
				const result = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 1,
					fd: 1,
				});
				expect(result).toBe(true);
			});

			it('denies when other process holds exclusive whole-file lock', async () => {
				// First process gets exclusive whole-file lock
				const result1 = lockManager.lockWholeFile('/test.txt', {
					type: 'exclusive',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get shared range lock
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('allows when other process holds shared whole-file lock', async () => {
				// First process gets shared whole-file lock
				const result1 = lockManager.lockWholeFile('/test.txt', {
					type: 'shared',
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process gets shared range lock
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(true);
			});

			// TODO: Merge exclusive/shared/unlock into name of test instead of making it a nested describe
			it('denies when other process holds overlapping exclusive range lock', async () => {
				// First process gets exclusive range lock
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 50n,
					end: 150n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process tries to get overlapping shared range lock
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(false);
			});

			it('allows when other process holds overlapping shared range lock', async () => {
				// First process gets shared range lock
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 50n,
					end: 150n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process gets overlapping shared range lock
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(true);
			});

			it('allows when other process holds non-overlapping exclusive range lock', async () => {
				// First process gets exclusive range lock
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 0n,
					end: 50n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process gets non-overlapping shared range lock
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 100n,
					end: 150n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(true);
			});

			it('allows when other process holds non-overlapping shared range lock', async () => {
				// First process gets shared range lock
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 0n,
					end: 50n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Second process gets non-overlapping shared range lock
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 100n,
					end: 150n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(true);
			});

			it('new lock request merges with overlapping locks from same process', async () => {
				// First get a shared range lock
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Replace it with a new overlapping lock
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 50n,
					end: 150n,
					pid: 1,
					fd: 1,
				});
				expect(result2).toBe(true);

				// Verify the old lock is gone by trying to get a lock in that range
				const result3 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 0n,
					end: 50n,
					pid: 2,
					fd: 1,
				});
				expect(result3).toBe(true);
			});

			it('treats a range with zero length as covering entire remaining range', async () => {
				// First get a shared range lock with zero length
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 100n,
					end: 100n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Try to get a lock in the remaining range
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(true);

				// Try to get a lock after the zero-length lock
				const result3 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 100n,
					end: 200n,
					pid: 2,
					fd: 1,
				});
				expect(result3).toBe(false);
			});
		});
		describe('unlock', () => {
			it('does not error when range not locked by current process', async () => {
				const result = lockManager.unlockFileByteRange('/test.txt', {
					start: 0n,
					end: 100n,
					pid: 1,
					fd: 1,
				});
				expect(result).toBeUndefined();
			});

			it('unlocks shared lock', async () => {
				// First get a shared range lock
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'shared',
					start: 0n,
					end: 100n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Unlock it
				lockManager.unlockFileByteRange('/test.txt', {
					start: 0n,
					end: 100n,
					pid: 1,
					fd: 1,
				});

				// Verify it's unlocked by getting an exclusive lock
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(true);
			});

			it('unlocks exclusive lock', async () => {
				// First get an exclusive range lock
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Unlock it
				lockManager.unlockFileByteRange('/test.txt', {
					start: 0n,
					end: 100n,
					pid: 1,
					fd: 1,
				});

				// Verify it's unlocked by getting an exclusive lock
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 0n,
					end: 100n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(true);
			});

			it('unlocks overlapping portions of locks from same process', async () => {
				// First get two overlapping locks
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 0n,
					end: 50n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 50n,
					end: 100n,
					pid: 1,
					fd: 1,
				});
				expect(result2).toBe(true);

				// Unlock a range that overlaps both locks
				lockManager.unlockFileByteRange('/test.txt', {
					start: 25n,
					end: 75n,
					pid: 1,
					fd: 1,
				});

				// Verify both locks are gone by getting a lock in that range
				const result3 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 25n,
					end: 75n,
					pid: 2,
					fd: 1,
				});
				expect(result3).toBe(true);
			});

			it('leaves locks owned by other processes intact', async () => {
				// First process gets two locks
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 0n,
					end: 50n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 50n,
					end: 100n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(true);

				// Unlock the first process's lock
				lockManager.unlockFileByteRange('/test.txt', {
					start: 0n,
					end: 50n,
					pid: 1,
					fd: 1,
				});

				// Verify second process's lock is still there
				const result3 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 50n,
					end: 100n,
					pid: 1,
					fd: 1,
				});
				expect(result3).toBe(false);
			});

			it('treats a range with zero length as covering entire remaining range', async () => {
				// First get a lock with zero length
				const result1 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 100n,
					end: 100n,
					pid: 1,
					fd: 1,
				});
				expect(result1).toBe(true);

				// Unlock it
				lockManager.unlockFileByteRange('/test.txt', {
					start: 100n,
					end: 100n,
					pid: 1,
					fd: 1,
				});

				// Verify it's unlocked by getting a lock after that point
				const result2 = lockManager.lockFileByteRange('/test.txt', {
					type: 'exclusive',
					start: 100n,
					end: 200n,
					pid: 2,
					fd: 1,
				});
				expect(result2).toBe(true);
			});
		});
	});

	describe('findFirstConflictingByteRangeLock', () => {
		it('should find conflicting exclusive lock with partial overlap', async () => {
			await lockManager.lockFileByteRange('/test.txt', {
				type: 'exclusive',
				start: 0n,
				end: 100n,
				pid: 1,
				fd: 1,
			});

			const conflict =
				await lockManager.findFirstConflictingByteRangeLock(
					'/test.txt',
					{
						type: 'shared',
						start: 50n,
						end: 150n,
						pid: 2,
						fd: 1,
					}
				);

			expect(conflict).toBeDefined();
			expect(conflict?.pid).toBe(1);
			expect(conflict?.type).toBe('exclusive');
		});

		it('should return undefined when no conflict exists', async () => {
			await lockManager.lockFileByteRange('/test.txt', {
				type: 'shared',
				start: 0n,
				end: 100n,
				pid: 1,
				fd: 1,
			});

			const conflict =
				await lockManager.findFirstConflictingByteRangeLock(
					'/test.txt',
					{
						type: 'shared',
						start: 150n,
						end: 250n,
						pid: 2,
						fd: 1,
					}
				);

			expect(conflict).toBeUndefined();
		});

		it('should handle a conflict with a whole-file lock', async () => {
			// First get an exclusive whole-file lock
			const result1 = lockManager.lockWholeFile('/test.txt', {
				type: 'exclusive',
				pid: 1,
				fd: 1,
			});
			expect(result1).toBe(true);

			// Try to get a range lock
			const conflict =
				await lockManager.findFirstConflictingByteRangeLock(
					'/test.txt',
					{
						type: 'shared',
						start: 0n,
						end: 100n,
						pid: 2,
						fd: 1,
					}
				);

			expect(conflict).toBeDefined();
			expect(conflict?.pid).toBe(1);
			expect(conflict?.type).toBe('exclusive');
		});
	});

	describe('releaseLocksForProcess', () => {
		it('should release all range locks held by a process across multiple ranges', async () => {
			await lockManager.lockFileByteRange('/test1.txt', {
				type: 'exclusive',
				start: 0n,
				end: 100n,
				pid: 1,
				fd: 1,
			});
			await lockManager.lockFileByteRange('/test1.txt', {
				type: 'exclusive',
				start: 200n,
				end: 300n,
				pid: 1,
				fd: 1,
			});
			const exclusiveLockAppearsToBeHeld =
				!(await lockManager.lockFileByteRange('/test1.txt', {
					type: 'shared',
					start: 0n,
					end: 300n,
					pid: 2,
					fd: 1,
				}));
			expect(exclusiveLockAppearsToBeHeld).toBe(true);

			await lockManager.lockFileByteRange('/test2.txt', {
				type: 'shared',
				start: 50n,
				end: 150n,
				pid: 1,
				fd: 1,
			});
			const sharedLockAppearsToBeHeld =
				!(await lockManager.lockFileByteRange('/test2.txt', {
					type: 'exclusive',
					start: 0n,
					end: 300n,
					pid: 2,
					fd: 1,
				}));
			expect(sharedLockAppearsToBeHeld).toBe(true);

			await lockManager.releaseLocksForProcess(1);

			// Verify locks are released by trying to acquire conflicting locks
			const exclusiveLockAppearsToBeReleased =
				await lockManager.lockFileByteRange('/test1.txt', {
					type: 'shared',
					start: 0n,
					end: 300n,
					pid: 2,
					fd: 1,
				});
			const sharedLockAppearsToBeReleased =
				await lockManager.lockFileByteRange('/test2.txt', {
					type: 'exclusive',
					start: 0n,
					end: 200n,
					pid: 2,
					fd: 1,
				});

			expect(exclusiveLockAppearsToBeReleased).toBe(true);
			expect(sharedLockAppearsToBeReleased).toBe(true);
		});

		it('should release all whole-file locks held by a process', async () => {
			await lockManager.lockWholeFile('/test1.txt', {
				type: 'exclusive',
				pid: 1,
				fd: 1,
			});
			const exclusiveLockAppearsToBeHeld =
				!(await lockManager.lockWholeFile('/test1.txt', {
					type: 'shared',
					pid: 2,
					fd: 1,
				}));
			expect(exclusiveLockAppearsToBeHeld).toBe(true);

			await lockManager.lockWholeFile('/test2.txt', {
				type: 'shared',
				pid: 1,
				fd: 1,
			});
			const sharedLockAppearsToBeHeld = !(await lockManager.lockWholeFile(
				'/test2.txt',
				{
					type: 'exclusive',
					pid: 2,
					fd: 1,
				}
			));
			expect(sharedLockAppearsToBeHeld).toBe(true);

			await lockManager.releaseLocksForProcess(1);

			const exclusiveLockAppearsToBeReleased =
				await lockManager.lockWholeFile('/test1.txt', {
					type: 'shared',
					pid: 2,
					fd: 1,
				});
			const sharedLockAppearsToBeReleased =
				await lockManager.lockWholeFile('/test2.txt', {
					type: 'exclusive',
					pid: 2,
					fd: 1,
				});

			expect(exclusiveLockAppearsToBeReleased).toBe(true);
			expect(sharedLockAppearsToBeReleased).toBe(true);
		});

		it('leaves locks owned by others intact', async () => {
			// First process gets two locks
			await lockManager.lockFileByteRange('/test.txt', {
				type: 'exclusive',
				start: 0n,
				end: 50n,
				pid: 1,
				fd: 1,
			});
			await lockManager.lockFileByteRange('/test.txt', {
				type: 'exclusive',
				start: 50n,
				end: 100n,
				pid: 2,
				fd: 1,
			});

			// Release first process's locks
			await lockManager.releaseLocksForProcess(1);

			// Verify second process's lock is still there
			const result = await lockManager.lockFileByteRange('/test.txt', {
				type: 'exclusive',
				start: 50n,
				end: 100n,
				pid: 1,
				fd: 1,
			});
			expect(result).toBe(false);
		});
	});

	describe('integration with native OS file locking', () => {
		it('obtains an exclusive native whole-file lock before granting an exclusive internal whole-file lock', async () => {
			// TODO: Implement
		});
		it('obtains an exclusive native whole-file lock before granting an exclusive internal range lock', async () => {
			// TODO: Implement
		});
		it('obtains a shared native whole-file lock before granting a shared internal whole-file lock', async () => {
			// TODO: Implement
		});
		it('obtains a native shared whole-file lock before granting a shared internal range lock', async () => {
			// TODO: Implement
		});
		it('downgrades a native exclusive whole-file lock to shared when only internal shared locks remain', async () => {
			// TODO: Implement
		});
		it('upgrades a native shared whole-file lock to exclusive before granting an exclusive internal whole-file lock', async () => {
			// TODO: Implement
		});
		it('upgrades a native, shared whole-file lock to exclusive before granting an exclusive internal range lock', async () => {
			// TODO: Implement
		});
		it('releases native file lock when no locks remain', async () => {
			// TODO: Implement
		});
	});
});
