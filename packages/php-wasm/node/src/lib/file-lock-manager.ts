import { logger } from '@php-wasm/logger';

// NOTE: This API is async because we intend to use it across worker boundaries.
export type FileLockManager = {
	/**
	 * Update the lock on the whole file.
	 *
	 * This method is for updating the lock on the whole file with the F_SETLKW fcntl() command.
	 * https://sourceware.org/glibc/manual/2.41/html_node/File-Locks.html#index-F_005fSETLKW-1
	 *
	 * @param path - The path to the file to lock.
	 * @param op - The operation to perform, including 'shared', 'exclusive', or 'unlock'.
	 * @returns A promise for a boolean value.
	 */
	lockWholeFile: (path: string, op: WholeFileLockOp) => Promise<boolean>;

	/**
	 * Lock a file.
	 *
	 * This method is for locking with the F_SETLK fcntl() command.
	 * https://sourceware.org/glibc/manual/2.41/html_node/File-Locks.html#index-F_005fSETLK-1
	 *
	 * @param path - The path to the file to lock.
	 * @param requestedLock - The lock to request, including start, end, type, and pid.
	 * @returns A promise for a boolean value.
	 *          True if the lock was acquired, false if it was not.
	 */
	lockFileByteRange: (
		path: string,
		requestedLock: LockRangeWithType
		// TODO: Consider if there is a better return type for this operation.
	) => Promise<boolean>;

	/**
	 * Release a lock on the file.
	 *
	 * This method is for unlocking with the F_SETLK fcntl() command.
	 * https://sourceware.org/glibc/manual/2.41/html_node/File-Locks.html#index-F_005fSETLK-1
	 *
	 * @param path - The path to the file to unlock.
	 * @param lockToRelease - The lock to release, including start, end, type, and pid.
	 * @returns A promise that resolves when the lock is released.
	 */
	unlockFileByteRange: (
		path: string,
		lockToRelease: LockRange
		// TODO: Return an optional error object
	) => Promise<void>;

	/**
	 * Get the first lock that would conflict with the specified lock.
	 *
	 * This method is meant to satisfy the needs of the F_GETLK fcntl() command.
	 * https://sourceware.org/glibc/manual/2.41/html_node/File-Locks.html#index-F_005fGETLK-1
	 *
	 * @param path - The path to the file to check for conflicts.
	 * @param desiredLock - The lock to check for conflicts.
	 * @returns A promise for the first conflicting lock,
	 *          or undefined if there is no conflict.
	 */
	findFirstConflictingByteRangeLock: (
		path: string,
		desiredLock: LockRangeWithType
	) => Promise<LockRangeWithType | undefined>;

	/**
	 * Release all locks for a given process.
	 *
	 * Used when a process exits or is otherwise terminated.
	 *
	 * @param pid - The PID of the process that wants to release the locks.
	 */
	releaseLocksForProcess: (pid: number) => Promise<void>;
};

export type LockRange = {
	/** The start offset of the lock range */
	start: bigint;
	/** The length of the lock range */
	end: bigint;
	/** The process ID that owns this lock */
	pid: number;
};

export type LockRangeWithType = LockRange & {
	/** The type of lock ('shared' or 'exclusive') */
	type: 'shared' | 'exclusive';
};

export type WholeFileLock =
	| WholeFileLock_Exclusive
	| WholeFileLock_Shared
	| WholeFileLock_Unlocked;

type WholeFileLock_Exclusive = {
	type: 'exclusive';
	pid: number;
};
type WholeFileLock_Shared = {
	type: 'shared';
	pids: Set<number>;
};
type WholeFileLock_Unlocked = {
	type: 'unlocked';
};

export type WholeFileLockOp = {
	pid: number;
	type: 'shared' | 'exclusive' | 'unlock';
};

export class FileLock {
	wholeFileLock: WholeFileLock;
	rangeLocks: FileLockIntervalTree;

	constructor() {
		this.rangeLocks = new FileLockIntervalTree();
		this.wholeFileLock = { type: 'unlocked' };
	}
}

class IntervalNode {
	range: LockRangeWithType;
	max: bigint;
	left: IntervalNode | null = null;
	right: IntervalNode | null = null;

	constructor(range: LockRangeWithType) {
		this.range = range;
		this.max = range.end;
	}
}

class FileLockIntervalTree {
	private root: IntervalNode | null = null;

	isEmpty() {
		return this.root === null;
	}

	/**
	 * Insert a new locked range into the tree
	 */
	insert(range: LockRangeWithType): void {
		this.root = this.insertNode(this.root, range);
	}

	private insertNode(
		node: IntervalNode | null,
		range: LockRangeWithType
	): IntervalNode {
		if (!node) {
			return new IntervalNode(range);
		}

		// Insert to left subtree if start is less than node's start
		if (range.start < node.range.start) {
			node.left = this.insertNode(node.left, range);
		} else {
			node.right = this.insertNode(node.right, range);
		}

		// Update max value
		node.max = this.bigintMax(node.max, range.end);
		return node;
	}

	private bigintMax(...args: bigint[]): bigint {
		return args.reduce((max, current) => {
			return current > max ? current : max;
		}, args[0]);
	}

	/**
	 * Find all ranges that overlap with the given range
	 */
	findOverlapping(range: LockRangeWithType): LockRangeWithType[] {
		const result: LockRangeWithType[] = [];
		this.findOverlappingRanges(this.root, range, result);
		return result;
	}

	private findOverlappingRanges(
		node: IntervalNode | null,
		range: LockRangeWithType,
		result: LockRangeWithType[]
	): void {
		if (!node) {
			return;
		}

		// Check if current node overlaps
		if (this.doRangesOverlap(node.range, range)) {
			result.push(node.range);
		}

		// If left child exists and its max is greater than range start, search left
		if (node.left && node.left.max >= range.start) {
			this.findOverlappingRanges(node.left, range, result);
		}

		// Search right if it could contain overlapping intervals
		if (node.right && node.range.start <= range.end) {
			this.findOverlappingRanges(node.right, range, result);
		}
	}

	private doRangesOverlap(
		a: LockRangeWithType,
		b: LockRangeWithType
	): boolean {
		return a.start <= b.end && b.start <= a.end;
	}

	/**
	 * Remove a lock range from the tree
	 */
	remove(range: LockRange): void {
		this.root = this.removeNode(this.root, range);
	}

	private removeNode(
		node: IntervalNode | null,
		range: LockRange
	): IntervalNode | null {
		if (!node) {
			return null;
		}

		// Check if current node is the one to remove
		if (this.areRangesEqual(node.range, range)) {
			// Handle cases of no children or one child
			if (!node.left) {
				return node.right;
			}
			if (!node.right) {
				return node.left;
			}

			// Node has two children - find successor
			const successor = this.findMin(node.right);
			node.range = successor.range;
			node.right = this.removeNode(node.right, successor.range);
		} else if (range.start < node.range.start) {
			node.left = this.removeNode(node.left, range);
		} else {
			node.right = this.removeNode(node.right, range);
		}

		// Update max value
		node.max = node.range.end;
		if (node.left) {
			node.max = this.bigintMax(node.max, node.left.max);
		}
		if (node.right) {
			node.max = this.bigintMax(node.max, node.right.max);
		}

		return node;
	}

	private findMin(node: IntervalNode): IntervalNode {
		let current = node;
		while (current.left) {
			current = current.left;
		}
		return current;
	}

	private areRangesEqual(a: LockRange, b: LockRange): boolean {
		return a.start === b.start && a.end === b.end && a.pid === b.pid;
	}

	findLocksForProcess(pid: number): LockRangeWithType[] {
		const result: LockRangeWithType[] = [];
		this.findLocksForProcessInNode(this.root, pid, result);
		return result;
	}

	private findLocksForProcessInNode(
		node: IntervalNode | null,
		pid: number,
		result: LockRangeWithType[]
	): void {
		if (!node) {
			return;
		}

		if (node.range.pid === pid) {
			result.push(node.range);
		}

		this.findLocksForProcessInNode(node.left, pid, result);
		this.findLocksForProcessInNode(node.right, pid, result);
	}

	areThereLocksForOtherProcesses(
		pid: number,
		type?: LockRangeWithType['type']
	): boolean {
		return this.areThereLocksForOtherProcessesInNode(this.root, pid, type);
	}

	private areThereLocksForOtherProcessesInNode(
		node: IntervalNode | null,
		pid: number,
		type?: LockRangeWithType['type'] | undefined
	): boolean {
		if (!node) {
			return false;
		}

		if (
			node.range.pid !== pid &&
			(type === undefined || node.range.type === type)
		) {
			return true;
		}

		return (
			this.areThereLocksForOtherProcessesInNode(node.left, pid, type) ||
			this.areThereLocksForOtherProcessesInNode(node.right, pid, type)
		);
	}
}

// TODO: Move this to dedicated file
export class FileLockManagerForNode implements FileLockManager {
	locks: Map<string, FileLock>;

	constructor() {
		this.locks = new Map();
	}

	// TODO: Comment reasoning
	async lockWholeFile(path: string, op: WholeFileLockOp): Promise<boolean> {
		console.log('wholeFileLock', path, op);
		if (this.locks.get(path) === undefined) {
			if (op.type === 'unlock') {
				return true;
			}

			this.locks.set(path, new FileLock());
		}

		const lock = this.locks.get(path)!;
		if (op.type === 'unlock') {
			if (lock.wholeFileLock.type === 'unlocked') {
				// Do nothing because the whole file is already unlocked.
			} else if (
				lock.wholeFileLock.type === 'exclusive' &&
				lock.wholeFileLock.pid === op.pid
			) {
				lock.wholeFileLock = { type: 'unlocked' };
			} else if (
				lock.wholeFileLock.type === 'shared' &&
				lock.wholeFileLock.pids.has(op.pid)
			) {
				lock.wholeFileLock.pids.delete(op.pid);
				if (lock.wholeFileLock.pids.size === 0) {
					lock.wholeFileLock = { type: 'unlocked' };
				}
			}

			this.forgetPathIfUnlocked(path);
			return true;
		}

		if (op.type === 'exclusive') {
			const thereIsAConflictingWholeFileLock =
				(lock.wholeFileLock.type === 'exclusive' &&
					lock.wholeFileLock.pid !== op.pid) ||
				(lock.wholeFileLock.type === 'shared' &&
					!(
						lock.wholeFileLock.pids.size === 1 ||
						lock.wholeFileLock.pids.has(op.pid)
					));
			const thereAreConflictingRangeLocks =
				lock.rangeLocks.areThereLocksForOtherProcesses(op.pid);

			if (
				thereIsAConflictingWholeFileLock ||
				thereAreConflictingRangeLocks
			) {
				return false;
			}

			lock.wholeFileLock = {
				type: 'exclusive',
				pid: op.pid,
			};
			return true;
		}

		if (op.type === 'shared') {
			const thereIsAConflictingWholeFileLock =
				lock.wholeFileLock.type === 'exclusive' &&
				lock.wholeFileLock.pid !== op.pid;
			const thereAreConflictingRangeLocks =
				lock.rangeLocks.areThereLocksForOtherProcesses(
					op.pid,
					'exclusive'
				);

			if (
				thereIsAConflictingWholeFileLock ||
				thereAreConflictingRangeLocks
			) {
				return false;
			}

			if (lock.wholeFileLock.type === 'unlocked') {
				lock.wholeFileLock = {
					type: 'shared',
					pids: new Set(),
				};
			}

			(lock.wholeFileLock as WholeFileLock_Shared).pids.add(op.pid);
			return true;
		}

		throw new Error(`Unexpected wholeFileLock() op: '${op.type}'`);
	}

	async lockFileByteRange(
		path: string,
		requestedLock: LockRangeWithType
	): Promise<boolean> {
		if (!this.locks.has(path)) {
			this.locks.set(path, new FileLock());
		}
		const lock = this.locks.get(path)!;

		if (
			lock.wholeFileLock.type === 'exclusive' &&
			lock.wholeFileLock.pid !== requestedLock.pid
		) {
			// Any exclusive lock not owned by the same process
			// conflicts with this request.
			return false;
		}
		if (
			requestedLock.type === 'exclusive' &&
			lock.wholeFileLock.type === 'shared' &&
			!(
				lock.wholeFileLock.pids.size === 1 &&
				lock.wholeFileLock.pids.has(requestedLock.pid)
			)
		) {
			// This request conflicts with shared file locks
			// owned by other processes.
			return false;
		}

		// There does not appear to be a conflicting whole file lock,
		// so we can proceed with attempting to lock a byte range.
		const rangeLocks = lock.rangeLocks;
		const overlappingLocks = rangeLocks.findOverlapping(requestedLock);
		const overlappingLocksFromSameProcess = overlappingLocks.filter(
			(lock) => lock.pid === requestedLock.pid
		);
		const overlappingLocksFromOtherProcesses = overlappingLocks.filter(
			(lock) => lock.pid !== requestedLock.pid
		);

		if (
			requestedLock.type === 'exclusive' &&
			overlappingLocksFromOtherProcesses.length > 0
		) {
			// The requested exclusive lock conflicts with existing locks from
			// another process.
			console.log(
				'  lock',
				path,
				`0x${requestedLock.start.toString(16).padStart(8, '0')}`,
				`0x${requestedLock.end.toString(16).padStart(8, '0')}`,
				'failure',
				'ex',
				`pid=${requestedLock.pid}`
			);
			return false;
		}

		if (
			requestedLock.type === 'shared' &&
			overlappingLocksFromOtherProcesses.some(
				(lock) => lock.type === 'exclusive'
			)
		) {
			// The requested shared lock conflicts with an existing exclusive
			// lock from another process.
			console.log(
				'  lock',
				path,
				`0x${requestedLock.start.toString(16).padStart(8, '0')}`,
				`0x${requestedLock.end.toString(16).padStart(8, '0')}`,
				'failure',
				'sh',
				`pid=${requestedLock.pid}`
			);
			return false;
		}

		// Remove overlapping locks from the same process because the requested
		// lock replaces them.
		for (const overlappingLock of overlappingLocksFromSameProcess) {
			rangeLocks.remove(overlappingLock);
		}

		rangeLocks.insert(requestedLock);

		console.log(
			'  lock',
			path,
			`0x${requestedLock.start.toString(16).padStart(8, '0')}`,
			`0x${requestedLock.end.toString(16).padStart(8, '0')}`,
			'success',
			requestedLock.type === 'exclusive' ? 'ex' : 'sh',
			`pid=${requestedLock.pid}`
		);
		return true;
	}

	async unlockFileByteRange(path: string, lockToRelease: LockRange) {
		const lock = this.locks.get(path);
		if (!lock) {
			console.log(
				'unlock',
				path,
				`0x${lockToRelease.start.toString(16).padStart(8, '0')}`,
				`0x${lockToRelease.end.toString(16).padStart(8, '0')}`,
				'failure',
				'  ',
				`pid=${lockToRelease.pid}`
			);
			// TODO: Return an error
			return;
		}

		// TODO: Confirm the lock is present and error if it is not.
		lock.rangeLocks.remove(lockToRelease);
		this.forgetPathIfUnlocked(path);

		console.log(
			'unlock',
			path,
			`0x${lockToRelease.start.toString(16).padStart(8, '0')}`,
			`0x${lockToRelease.end.toString(16).padStart(8, '0')}`,
			'success',
			'  ',
			`pid=${lockToRelease.pid}`
		);
	}

	async findFirstConflictingByteRangeLock(
		path: string,
		desiredLock: LockRangeWithType
	): Promise<LockRangeWithType | undefined> {
		logger.log('findConflictingLock', path, desiredLock);

		if (!this.locks.has(path)) {
			return undefined;
		}

		const lockTree = this.locks.get(path)!.rangeLocks;
		const overlappingLocks = lockTree.findOverlapping(desiredLock);
		const firstConflictingLock = overlappingLocks.find(
			(lock) => lock.pid !== desiredLock.pid
		);

		if (firstConflictingLock) {
			return firstConflictingLock;
		}

		return undefined;
	}

	async releaseLocksForProcess(pid: number) {
		logger.log('releaseLocksForProcess', pid);
		for (const [path, lock] of this.locks.entries()) {
			for (const rangeLock of lock.rangeLocks.findLocksForProcess(pid)) {
				// TODO: Explain why we are using the public interface instead of directly adjusting data structures
				this.unlockFileByteRange(path, {
					start: rangeLock.start,
					end: rangeLock.end,
					pid,
				});
			}

			// TODO: Explain why we are using the public interface instead of directly adjusting data structures
			if (lock.wholeFileLock.type !== 'unlocked') {
				this.lockWholeFile(path, {
					pid,
					type: 'unlock',
				});
			}
		}
	}

	private forgetPathIfUnlocked(path: string) {
		const lock = this.locks.get(path);
		if (!lock) {
			return;
		}

		if (
			lock.rangeLocks.isEmpty() &&
			lock.wholeFileLock.type === 'unlocked'
		) {
			this.locks.delete(path);
		}
	}
}
