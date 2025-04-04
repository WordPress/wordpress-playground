import { FcntlFileLockManagerForNode } from '../lib/fcntl-file-locking';

// TODO: Review these tests with a critical eye before merging. They are AI-generated.
describe('FcntlFileLockManagerForNode', () => {
	let lockManager: FcntlFileLockManagerForNode;

	beforeEach(() => {
		lockManager = new FcntlFileLockManagerForNode();
	});

	describe('lockFile', () => {
		it('should allow acquiring an exclusive lock on an unlocked file', async () => {
			const result = await lockManager.lockFile('/test.txt', {
				type: 'exclusive',
				start: 0n,
				end: 100n,
				pid: 1,
			});
			expect(result).toBe(true);
		});

		it('should allow acquiring a shared lock on an unlocked file', async () => {
			const result = await lockManager.lockFile('/test.txt', {
				type: 'shared',
				start: 0n,
				end: 100n,
				pid: 1,
			});
			expect(result).toBe(true);
		});

		it('should allow multiple shared locks with overlapping ranges from different processes', async () => {
			// First process locks 0-100
			await lockManager.lockFile('/test.txt', {
				type: 'shared',
				start: 0n,
				end: 100n,
				pid: 1,
			});

			// Second process locks 50-150
			const result1 = await lockManager.lockFile('/test.txt', {
				type: 'shared',
				start: 50n,
				end: 150n,
				pid: 2,
			});

			// Third process locks 25-75
			const result2 = await lockManager.lockFile('/test.txt', {
				type: 'shared',
				start: 25n,
				end: 75n,
				pid: 3,
			});

			expect(result1).toBe(true);
			expect(result2).toBe(true);
		});

		it('should replace all overlapping locks from same process with new lock', async () => {
			// Create multiple overlapping locks from same process
			await lockManager.lockFile('/test.txt', {
				type: 'shared',
				start: 0n,
				end: 50n,
				pid: 1,
			});

			await lockManager.lockFile('/test.txt', {
				type: 'shared',
				start: 25n,
				end: 75n,
				pid: 1,
			});

			await lockManager.lockFile('/test.txt', {
				type: 'shared',
				start: 60n,
				end: 100n,
				pid: 1,
			});

			// New lock should replace all previous overlapping locks
			const result = await lockManager.lockFile('/test.txt', {
				type: 'exclusive',
				start: 20n,
				end: 80n,
				pid: 1,
			});

			expect(result).toBe(true);

			// Verify by trying to acquire a shared lock from another process
			// Should fail because exclusive lock exists
			const verifyResult = await lockManager.lockFile('/test.txt', {
				type: 'shared',
				start: 30n,
				end: 70n,
				pid: 2,
			});

			expect(verifyResult).toBe(false);
		});

		it('should not allow exclusive lock when partially overlapping shared lock exists', async () => {
			await lockManager.lockFile('/test.txt', {
				type: 'shared',
				start: 50n,
				end: 150n,
				pid: 1,
			});

			const result = await lockManager.lockFile('/test.txt', {
				type: 'exclusive',
				start: 100n,
				end: 200n,
				pid: 2,
			});
			expect(result).toBe(false);
		});

		it('should not allow shared lock when partially overlapping exclusive lock exists', async () => {
			await lockManager.lockFile('/test.txt', {
				type: 'exclusive',
				start: 50n,
				end: 150n,
				pid: 1,
			});

			const result = await lockManager.lockFile('/test.txt', {
				type: 'shared',
				start: 0n,
				end: 100n,
				pid: 2,
			});
			expect(result).toBe(false);
		});

		it('should allow replacing own overlapping locks with different ranges', async () => {
			await lockManager.lockFile('/test.txt', {
				type: 'shared',
				start: 0n,
				end: 100n,
				pid: 1,
			});

			await lockManager.lockFile('/test.txt', {
				type: 'shared',
				start: 50n,
				end: 150n,
				pid: 1,
			});

			const result = await lockManager.lockFile('/test.txt', {
				type: 'exclusive',
				start: 25n,
				end: 125n,
				pid: 1,
			});
			expect(result).toBe(true);
		});
	});

	describe('unlockFile', () => {
		it('should successfully unlock a locked range', async () => {
			await lockManager.lockFile('/test.txt', {
				type: 'exclusive',
				start: 0n,
				end: 100n,
				pid: 1,
			});

			await expect(
				lockManager.unlockFile('/test.txt', {
					start: 0n,
					end: 100n,
					pid: 1,
				})
			).resolves.toBeUndefined();
		});
	});

	describe('findConflictingLock', () => {
		it('should find conflicting exclusive lock with partial overlap', async () => {
			await lockManager.lockFile('/test.txt', {
				type: 'exclusive',
				start: 0n,
				end: 100n,
				pid: 1,
			});

			const conflict = await lockManager.findConflictingLock(
				'/test.txt',
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

		it('should return undefined when no conflict exists with non-overlapping ranges', async () => {
			await lockManager.lockFile('/test.txt', {
				type: 'shared',
				start: 0n,
				end: 100n,
				pid: 1,
			});

			const conflict = await lockManager.findConflictingLock(
				'/test.txt',
				{
					type: 'shared',
					start: 150n,
					end: 250n,
					pid: 2,
				}
			);

			expect(conflict).toBeUndefined();
		});
	});

	describe('releaseLocksForProcess', () => {
		it('should release all locks held by a process across multiple ranges', async () => {
			await lockManager.lockFile('/test1.txt', {
				type: 'exclusive',
				start: 0n,
				end: 100n,
				pid: 1,
			});

			await lockManager.lockFile('/test1.txt', {
				type: 'exclusive',
				start: 200n,
				end: 300n,
				pid: 1,
			});

			await lockManager.lockFile('/test2.txt', {
				type: 'shared',
				start: 50n,
				end: 150n,
				pid: 1,
			});

			await lockManager.releaseLocksForProcess(1);

			// Verify locks are released by trying to acquire exclusive locks
			const result1 = await lockManager.lockFile('/test1.txt', {
				type: 'exclusive',
				start: 0n,
				end: 300n,
				pid: 2,
			});
			const result2 = await lockManager.lockFile('/test2.txt', {
				type: 'exclusive',
				start: 0n,
				end: 200n,
				pid: 2,
			});

			expect(result1).toBe(true);
			expect(result2).toBe(true);
		});
	});
});
