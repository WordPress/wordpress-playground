import { logger } from '@php-wasm/logger';

// NOTE: This API is async because we intend to use it across worker boundaries.
export type FcntlFileLockManager = {
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
	lockFile: (
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
	unlockFile: (
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
	findConflictingLock: (
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

export interface LockRange {
	/** The start offset of the lock range */
	start: bigint;
	/** The length of the lock range */
	end: bigint;
	/** The process ID that owns this lock */
	pid: number;
}

export interface LockRangeWithType extends LockRange {
	/** The type of lock ('shared' or 'exclusive') */
	type: 'shared' | 'exclusive';
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
}

export class FcntlFileLockManagerForNode implements FcntlFileLockManager {
	locks: Map<string, FileLockIntervalTree>;

	constructor() {
		this.locks = new Map();
	}

	async lockFile(
		path: string,
		requestedLock: LockRangeWithType
	): Promise<boolean> {
		if (!this.locks.has(path)) {
			this.locks.set(path, new FileLockIntervalTree());
		}
		const lockTree = this.locks.get(path)!;

		const overlappingLocks = lockTree.findOverlapping(requestedLock);
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
				'failure'
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
				'failure'
			);
			return false;
		}

		// Remove overlapping locks from the same process because the requested
		// lock replaces them.
		for (const overlappingLock of overlappingLocksFromSameProcess) {
			lockTree.remove(overlappingLock);
		}

		lockTree.insert(requestedLock);

		console.log(
			'  lock',
			path,
			`0x${requestedLock.start.toString(16).padStart(8, '0')}`,
			`0x${requestedLock.end.toString(16).padStart(8, '0')}`,
			'success'
		);
		return true;
	}

	async unlockFile(path: string, lockToRelease: LockRange) {
		const lockTree = this.locks.get(path);
		if (!lockTree) {
			console.log(
				'unlock',
				path,
				`0x${lockToRelease.start.toString(16).padStart(8, '0')}`,
				`0x${lockToRelease.end.toString(16).padStart(8, '0')}`,
				'failure'
			);
			// TODO: Return an error
			return;
		}

		// TODO: Confirm the lock is present and error if it is not.
		lockTree.remove(lockToRelease);

		console.log(
			'unlock',
			path,
			`0x${lockToRelease.start.toString(16).padStart(8, '0')}`,
			`0x${lockToRelease.end.toString(16).padStart(8, '0')}`,
			'success'
		);
	}

	async findConflictingLock(
		path: string,
		desiredLock: LockRangeWithType
	): Promise<LockRangeWithType | undefined> {
		logger.log('findConflictingLock', path, desiredLock);

		const lockTree = this.locks.get(path);
		if (lockTree === undefined) {
			return undefined;
		}

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
		for (const lockTree of this.locks.values()) {
			for (const lock of lockTree.findLocksForProcess(pid)) {
				lockTree.remove(lock);
			}
		}
	}
}
