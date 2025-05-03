import { logger } from '@php-wasm/logger';

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
	lockWholeFile: (path: string, op: WholeFileLockOp) => boolean;

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
	) => boolean;

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
	) => void;

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
	) => LockRangeWithType | undefined;

	/**
	 * Release all locks for a given process.
	 *
	 * Used when a process exits or is otherwise terminated.
	 *
	 * @param pid - The PID of the process that wants to release the locks.
	 */
	releaseLocksForProcess: (pid: number) => void;

	releaseLocksForProcessFd: (pid: number, fd: number, path: string) => void;
};

export type LockRange = {
	/** The start offset of the lock range */
	start: bigint;
	/** The length of the lock range */
	end: bigint;
	/** The process ID that owns this lock */
	pid: Pid;
	/** The file descriptor that owns this lock.
	 * Note: This is not needed for range locking but is needed to detect
	 * conflicts with whole file locks.
	 */
	fd: Fd;
};

type LockRangeWithType = LockRange & {
	/** The type of lock ('shared' or 'exclusive') */
	type: 'shared' | 'exclusive';
};

type WholeFileLock =
	| WholeFileLock_Exclusive
	| WholeFileLock_Shared
	| WholeFileLock_Unlocked;

type Pid = number;
type Fd = number;

type WholeFileLock_Exclusive = {
	type: 'exclusive';
	pid: Pid;
	fd: Fd;
};
type WholeFileLock_Shared = {
	type: 'shared';
	pidFds: Map<Pid, Set<Fd>>;
};
type WholeFileLock_Unlocked = {
	type: 'unlocked';
};

export type WholeFileLockOp = {
	pid: number;
	fd: number;
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
	findOverlapping(range: LockRange): LockRangeWithType[] {
		const result: LockRangeWithType[] = [];
		this.findOverlappingRanges(this.root, range, result);
		return result;
	}

	private findOverlappingRanges(
		node: IntervalNode | null,
		range: LockRange,
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

	private doRangesOverlap(a: LockRange, b: LockRange): boolean {
		return a.start < b.end && b.start < a.end;
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

	findLocksForProcess(pid: number, fd?: number): LockRangeWithType[] {
		const result: LockRangeWithType[] = [];
		this.findLocksForProcessInNode(this.root, pid, fd, result);
		return result;
	}

	private findLocksForProcessInNode(
		node: IntervalNode | null,
		pid: number,
		fd: number | undefined,
		result: LockRangeWithType[]
	): void {
		if (!node) {
			return;
		}

		if (
			node.range.pid === pid &&
			(fd === undefined || node.range.fd === fd)
		) {
			result.push(node.range);
		}

		this.findLocksForProcessInNode(node.left, pid, fd, result);
		this.findLocksForProcessInNode(node.right, pid, fd, result);
	}

	areThereLocksForOtherFileDescriptors(
		pid: Pid,
		fd: Fd,
		type?: LockRangeWithType['type']
	): boolean {
		return this.areThereLocksForOtherProcessesInNode(
			this.root,
			pid,
			fd,
			type
		);
	}

	private areThereLocksForOtherProcessesInNode(
		node: IntervalNode | null,
		pid: Pid,
		fd: Fd,
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
			this.areThereLocksForOtherProcessesInNode(
				node.left,
				pid,
				fd,
				type
			) ||
			this.areThereLocksForOtherProcessesInNode(node.right, pid, fd, type)
		);
	}
}

// TODO: Move this to dedicated file
// TODO: Make this more clearly readable
export class FileLockManagerForNode implements FileLockManager {
	locks: Map<string, FileLock>;

	constructor() {
		this.locks = new Map();
	}

	// TODO: Comment reasoning
	// TODO: Replace lock on a redundant fd with a desired lock by the same process
	lockWholeFile(path: string, op: WholeFileLockOp): boolean {
		console.log(`[${new Date().toISOString()}] wholeFileLock`, path, op);
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
				lock.wholeFileLock.pid === op.pid &&
				lock.wholeFileLock.fd === op.fd
			) {
				lock.wholeFileLock = { type: 'unlocked' };
			} else if (
				lock.wholeFileLock.type === 'shared' &&
				lock.wholeFileLock.pidFds.has(op.pid) &&
				lock.wholeFileLock.pidFds.get(op.pid)!.has(op.fd)
			) {
				lock.wholeFileLock.pidFds.get(op.pid)!.delete(op.fd);
				if (lock.wholeFileLock.pidFds.get(op.pid)!.size === 0) {
					lock.wholeFileLock.pidFds.delete(op.pid);
				}
			}

			this.forgetPathIfUnlocked(path);
			return true;
		}

		if (op.type === 'exclusive') {
			const thereIsAConflictingWholeFileLock =
				(lock.wholeFileLock.type === 'exclusive' &&
					!(
						lock.wholeFileLock.pid === op.pid &&
						lock.wholeFileLock.fd === op.fd
					)) ||
				(lock.wholeFileLock.type === 'shared' &&
					!(
						lock.wholeFileLock.pidFds.size === 1 &&
						lock.wholeFileLock.pidFds.has(op.pid) &&
						lock.wholeFileLock.pidFds.get(op.pid)!.size === 1 &&
						lock.wholeFileLock.pidFds.get(op.pid)!.has(op.fd)
					));
			const thereAreConflictingRangeLocks =
				lock.rangeLocks.areThereLocksForOtherFileDescriptors(
					op.pid,
					op.fd
				);

			if (
				thereIsAConflictingWholeFileLock ||
				thereAreConflictingRangeLocks
			) {
				return false;
			}

			lock.wholeFileLock = {
				type: 'exclusive',
				pid: op.pid,
				fd: op.fd,
			};
			return true;
		}

		if (op.type === 'shared') {
			const thereIsAConflictingWholeFileLock =
				lock.wholeFileLock.type === 'exclusive' &&
				!(
					lock.wholeFileLock.pid === op.pid &&
					lock.wholeFileLock.fd === op.fd
				);
			const thereAreConflictingRangeLocks =
				lock.rangeLocks.areThereLocksForOtherFileDescriptors(
					op.pid,
					op.fd,
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
					pidFds: new Map(),
				};
			}

			const sharedLock = lock.wholeFileLock as WholeFileLock_Shared;
			if (!sharedLock.pidFds.has(op.pid)) {
				sharedLock.pidFds.set(op.pid, new Set());
			}
			sharedLock.pidFds.get(op.pid)!.add(op.fd);
			return true;
		}

		throw new Error(`Unexpected wholeFileLock() op: '${op.type}'`);
	}

	lockFileByteRange(path: string, requestedLock: LockRangeWithType): boolean {
		if (!this.locks.has(path)) {
			this.locks.set(path, new FileLock());
		}
		const lock = this.locks.get(path)!;

		// TODO: Add some predicates to make this more readable
		if (
			lock.wholeFileLock.type === 'exclusive' &&
			lock.wholeFileLock.pid !== requestedLock.pid
		) {
			// Any exclusive lock not owned by the same process and file descriptor
			// conflicts with this request.
			return false;
		}
		if (
			requestedLock.type === 'exclusive' &&
			lock.wholeFileLock.type === 'shared' &&
			!(
				lock.wholeFileLock.pidFds.size === 1 &&
				lock.wholeFileLock.pidFds.has(requestedLock.pid) &&
				lock.wholeFileLock.pidFds.get(requestedLock.pid)!.size === 1 &&
				lock.wholeFileLock.pidFds
					.get(requestedLock.pid)!
					.has(requestedLock.fd)
			)
		) {
			// This request conflicts with shared file locks
			// owned by other processes and/or file descriptors.
			return false;
		}

		// There does not appear to be a conflicting whole file lock,
		// so we can proceed with attempting to lock a byte range.
		const rangeLocks = lock.rangeLocks;
		const overlappingLocks = rangeLocks.findOverlapping(requestedLock);
		const overlappingLocksFromSameProcess = overlappingLocks.filter(
			(lock) => lock.pid === requestedLock.pid
		);
		const overlappingLocksFromOthers = overlappingLocks.filter(
			(lock) => lock.pid !== requestedLock.pid
		);

		if (
			requestedLock.type === 'exclusive' &&
			overlappingLocksFromOthers.length > 0
		) {
			// The requested exclusive lock conflicts with existing locks from
			// other processes and/or file descriptors.
			console.log(
				`[${new Date().toISOString()}]  lock`,
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
			overlappingLocksFromOthers.some((lock) => lock.type === 'exclusive')
		) {
			// The requested shared lock conflicts with an existing exclusive
			// lock from another process.
			console.log(
				`[${new Date().toISOString()}]  lock`,
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
			`[${new Date().toISOString()}]  lock`,
			path,
			`0x${requestedLock.start.toString(16).padStart(8, '0')}`,
			`0x${requestedLock.end.toString(16).padStart(8, '0')}`,
			'success',
			requestedLock.type === 'exclusive' ? 'ex' : 'sh',
			`pid=${requestedLock.pid}`
		);
		return true;
	}

	// TODO: Consider unifying unlockFileByteRange and lockFileByteRange
	unlockFileByteRange(path: string, lockToRelease: LockRange) {
		const lock = this.locks.get(path);
		if (!lock) {
			console.log(
				`[${new Date().toISOString()}] unlock`,
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

		console.log(
			`[${new Date().toISOString()}] unlock`,
			path,
			`0x${lockToRelease.start.toString(16).padStart(8, '0')}`,
			`0x${lockToRelease.end.toString(16).padStart(8, '0')}`,
			'success',
			'  ',
			`pid=${lockToRelease.pid}`
		);

		// Unlock all overlapping locks from the same process.
		// TODO: What should happen to partial overlaps?
		const overlappingLocks = lock.rangeLocks.findOverlapping(lockToRelease);
		const overlappingLocksFromSameProcess = overlappingLocks.filter(
			(lock) => lock.pid === lockToRelease.pid
		);
		for (const overlappingRangeLock of overlappingLocksFromSameProcess) {
			console.log(
				`[${new Date().toISOString()}] unlocking overlapping lock`,
				path,
				`0x${overlappingRangeLock.start.toString(16).padStart(8, '0')}`,
				`0x${overlappingRangeLock.end.toString(16).padStart(8, '0')}`
			);
			lock.rangeLocks.remove(overlappingRangeLock);
		}

		this.forgetPathIfUnlocked(path);
	}

	// TODO: Handle whole file lock case
	findFirstConflictingByteRangeLock(
		path: string,
		desiredLock: LockRangeWithType
	): LockRangeWithType | undefined {
		logger.log(`[${new Date().toISOString()}] findConflictingLock`, path, {
			type: desiredLock.type,
			start: '0x' + desiredLock.start.toString(16).padStart(8, '0'),
			end: '0x' + desiredLock.end.toString(16).padStart(8, '0'),
			pid: desiredLock.pid,
			fd: desiredLock.fd,
		});

		if (!this.locks.has(path)) {
			return undefined;
		}

		const lockTree = this.locks.get(path)!.rangeLocks;
		const overlappingLocks = lockTree.findOverlapping(desiredLock);
		const firstConflictingLock = overlappingLocks.find(
			// TODO: Document why we are not checking for fd equality
			(lock) => lock.pid !== desiredLock.pid
		);

		if (firstConflictingLock) {
			return firstConflictingLock;
		}

		return undefined;
	}

	releaseLocksForProcess(pid: number) {
		logger.log(`[${new Date().toISOString()}] releaseLocksForProcess`, pid);
		for (const [path, lock] of this.locks.entries()) {
			for (const rangeLock of lock.rangeLocks.findLocksForProcess(pid)) {
				// TODO: Explain why we are using the public interface instead of directly adjusting data structures
				this.unlockFileByteRange(path, rangeLock);
			}

			const { wholeFileLock } = lock;
			if (
				wholeFileLock.type === 'exclusive' &&
				wholeFileLock.pid === pid
			) {
				this.lockWholeFile(path, {
					type: 'unlock',
					pid,
					fd: wholeFileLock.fd,
				});
			} else if (
				wholeFileLock.type === 'shared' &&
				wholeFileLock.pidFds.has(pid)
			) {
				for (const fd of wholeFileLock.pidFds.get(pid)!) {
					this.lockWholeFile(path, {
						type: 'unlock',
						pid,
						fd,
					});
				}
			}
		}
	}

	releaseLocksForProcessFd(pid: number, fd: number, path: string) {
		console.log(
			`[${new Date().toISOString()}] releaseLocksForProcessFd`,
			pid,
			fd,
			path
		);
		const lock = this.locks.get(path);
		if (!lock) {
			return;
		}

		// According to
		// https://chris.improbable.org/2010/12/16/everything-you-never-wanted-to-know-about-file-locking/
		// "If you open both databases in sqlite at the same time, then close the second one, all your open sqlite locks on the first one will be lost!"
		// TODO: Confirm and find better reference.
		// Closing an fd for a file releases all fcntl locks for the owning process.
		for (const rangeLock of lock.rangeLocks.findLocksForProcess(pid)) {
			// TODO: Explain why we are using the public interface instead of directly adjusting data structures
			this.unlockFileByteRange(path, {
				start: rangeLock.start,
				end: rangeLock.end,
				pid: rangeLock.pid,
				fd: rangeLock.fd,
			});
		}

		// TODO: Explain why we are using the public interface instead of directly adjusting data structures
		if (lock.wholeFileLock.type !== 'unlocked') {
			this.lockWholeFile(path, {
				pid,
				fd,
				type: 'unlock',
			});
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
