import { FileLockIntervalTree } from '../lib/file-lock-interval-tree';
import type { LockedRange } from '../lib/file-lock-manager';

function sharedLock(start: bigint, end: bigint, pid = 1, fd = 1): LockedRange {
	return { type: 'shared', start, end, pid, fd };
}

function exclusiveLock(
	start: bigint,
	end: bigint,
	pid = 1,
	fd = 1
): LockedRange {
	return { type: 'exclusive', start, end, pid, fd };
}

describe('FileLockIntervalTree', () => {
	let tree: FileLockIntervalTree;

	beforeEach(() => {
		tree = new FileLockIntervalTree();
	});

	describe('isEmpty', () => {
		it('returns true for a new tree', () => {
			expect(tree.isEmpty()).toBe(true);
		});

		it('returns false after inserting a range', () => {
			tree.insert(sharedLock(0n, 10n));
			expect(tree.isEmpty()).toBe(false);
		});

		it('returns true after removing the only range', () => {
			const lock = sharedLock(0n, 10n);
			tree.insert(lock);
			tree.remove(lock);
			expect(tree.isEmpty()).toBe(true);
		});
	});

	describe('insert and findOverlapping', () => {
		it('finds a single overlapping range', () => {
			const lock = sharedLock(0n, 10n);
			tree.insert(lock);
			const result = tree.findOverlapping({ start: 5n, end: 15n });
			expect(result).toEqual([lock]);
		});

		it('returns empty array when no overlaps exist', () => {
			tree.insert(sharedLock(0n, 10n));
			const result = tree.findOverlapping({ start: 10n, end: 20n });
			expect(result).toEqual([]);
		});

		it('finds multiple overlapping ranges', () => {
			const lock1 = sharedLock(0n, 10n);
			const lock2 = sharedLock(5n, 15n);
			const lock3 = sharedLock(20n, 30n);
			tree.insert(lock1);
			tree.insert(lock2);
			tree.insert(lock3);

			const result = tree.findOverlapping({ start: 8n, end: 12n });
			expect(result).toContainEqual(lock1);
			expect(result).toContainEqual(lock2);
			expect(result).not.toContainEqual(lock3);
		});

		it('does not treat touching ranges as overlapping', () => {
			// [0, 10) and [10, 20) do not overlap because
			// doRangesOverlap uses strict less-than
			tree.insert(sharedLock(0n, 10n));
			const result = tree.findOverlapping({ start: 10n, end: 20n });
			expect(result).toEqual([]);
		});

		it('finds overlaps with a single-byte query range', () => {
			const lock = sharedLock(0n, 100n);
			tree.insert(lock);
			const result = tree.findOverlapping({ start: 50n, end: 51n });
			expect(result).toEqual([lock]);
		});

		it('handles large ranges', () => {
			const lock = sharedLock(0n, 2n ** 53n);
			tree.insert(lock);
			const result = tree.findOverlapping({
				start: 2n ** 52n,
				end: 2n ** 53n,
			});
			expect(result).toEqual([lock]);
		});
	});

	describe('remove', () => {
		it('removes a range from the tree', () => {
			const lock = sharedLock(0n, 10n);
			tree.insert(lock);
			tree.remove(lock);
			expect(tree.findOverlapping({ start: 0n, end: 10n })).toEqual([]);
		});

		it('does not remove ranges with different pid', () => {
			const lock1 = sharedLock(0n, 10n, 1);
			const lock2 = sharedLock(0n, 10n, 2);
			tree.insert(lock1);
			tree.remove(lock2);
			expect(tree.findOverlapping({ start: 0n, end: 10n })).toEqual([
				lock1,
			]);
		});

		it('does not remove ranges with different fd', () => {
			const lock1 = sharedLock(0n, 10n, 1, 1);
			const lock2 = sharedLock(0n, 10n, 1, 2);
			tree.insert(lock1);
			tree.remove(lock2);
			expect(tree.findOverlapping({ start: 0n, end: 10n })).toEqual([
				lock1,
			]);
		});

		it('only removes the matching range when multiple exist', () => {
			const lock1 = sharedLock(0n, 10n);
			const lock2 = sharedLock(5n, 15n);
			tree.insert(lock1);
			tree.insert(lock2);
			tree.remove(lock1);

			const result = tree.findOverlapping({ start: 0n, end: 20n });
			expect(result).toEqual([lock2]);
		});

		it('handles removing a non-existent range gracefully', () => {
			tree.insert(sharedLock(0n, 10n));
			tree.remove(sharedLock(100n, 200n));
			expect(tree.findOverlapping({ start: 0n, end: 10n })).toHaveLength(
				1
			);
		});

		it('removes node with two children correctly', () => {
			// Build a tree with left and right children on the root,
			// then remove the root
			const lock1 = sharedLock(10n, 20n, 1);
			const lock2 = sharedLock(5n, 15n, 2);
			const lock3 = sharedLock(15n, 25n, 3);
			tree.insert(lock1); // root
			tree.insert(lock2); // left child
			tree.insert(lock3); // right child

			tree.remove(lock1);

			expect(tree.findOverlapping({ start: 0n, end: 30n })).toEqual(
				expect.arrayContaining([lock2, lock3])
			);
			expect(
				tree.findOverlapping({ start: 10n, end: 20n })
			).not.toContainEqual(lock1);
		});
	});

	describe('findLocksForProcess', () => {
		it('returns empty array when tree is empty', () => {
			expect(tree.findLocksForProcess(1)).toEqual([]);
		});

		it('finds all locks for a specific process', () => {
			const lock1 = sharedLock(0n, 10n, 1);
			const lock2 = exclusiveLock(20n, 30n, 1);
			const lock3 = sharedLock(40n, 50n, 2);
			tree.insert(lock1);
			tree.insert(lock2);
			tree.insert(lock3);

			const result = tree.findLocksForProcess(1);
			expect(result).toHaveLength(2);
			expect(result).toContainEqual(lock1);
			expect(result).toContainEqual(lock2);
		});

		it('returns empty array when no locks match the pid', () => {
			tree.insert(sharedLock(0n, 10n, 1));
			expect(tree.findLocksForProcess(99)).toEqual([]);
		});
	});

	describe('findStrictestExistingLockType', () => {
		it('returns unlocked for an empty tree', () => {
			expect(tree.findStrictestExistingLockType()).toBe('unlocked');
		});

		it('returns shared when only shared locks exist', () => {
			tree.insert(sharedLock(0n, 10n));
			tree.insert(sharedLock(20n, 30n));
			expect(tree.findStrictestExistingLockType()).toBe('shared');
		});

		it('returns exclusive when an exclusive lock exists', () => {
			tree.insert(sharedLock(0n, 10n));
			tree.insert(exclusiveLock(20n, 30n));
			expect(tree.findStrictestExistingLockType()).toBe('exclusive');
		});

		it('returns exclusive when only exclusive locks exist', () => {
			tree.insert(exclusiveLock(0n, 10n));
			expect(tree.findStrictestExistingLockType()).toBe('exclusive');
		});

		it('returns unlocked after all locks are removed', () => {
			const lock = exclusiveLock(0n, 10n);
			tree.insert(lock);
			tree.remove(lock);
			expect(tree.findStrictestExistingLockType()).toBe('unlocked');
		});
	});

	describe('multiple operations', () => {
		it('maintains correct state through insert, remove, and query', () => {
			const lock1 = sharedLock(0n, 10n, 1);
			const lock2 = exclusiveLock(10n, 20n, 2);
			const lock3 = sharedLock(20n, 30n, 1);

			tree.insert(lock1);
			tree.insert(lock2);
			tree.insert(lock3);

			// All three are present
			expect(tree.findOverlapping({ start: 0n, end: 30n })).toHaveLength(
				3
			);

			// Remove the middle one
			tree.remove(lock2);
			expect(tree.findOverlapping({ start: 0n, end: 30n })).toHaveLength(
				2
			);
			expect(tree.findLocksForProcess(2)).toEqual([]);

			// Strictest remaining is shared
			expect(tree.findStrictestExistingLockType()).toBe('shared');
		});

		it('handles inserting multiple locks at the same start position', () => {
			const lock1 = sharedLock(0n, 10n, 1);
			const lock2 = sharedLock(0n, 20n, 2);
			tree.insert(lock1);
			tree.insert(lock2);

			const result = tree.findOverlapping({ start: 0n, end: 5n });
			expect(result).toHaveLength(2);
		});
	});
});
