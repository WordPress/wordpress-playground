import { logger } from '@php-wasm/logger';
import { openSync, closeSync } from 'fs';
import { flockSync as nativeFlockSync } from 'fs-ext';
import type {
	FileLockManager,
	LockRange,
	LockRangeWithType,
	WholeFileLock,
	WholeFileLockOp,
	WholeFileLock_Shared,
	Pid,
	Fd,
} from './file-lock-manager';

type NativeLock = {
	fd: number;
	// TODO: Use a named type and share it within this module
	mode: 'exclusive' | 'shared';
};

// TODO: Try in-memory SQLite journal
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

export class FileLock {
	// TODO: Improve name
	// TODO: Document that it obtains a native file lock if possible and fails otherwise
	static create(
		path: string,
		mode: 'exclusive' | 'shared'
	): FileLock | undefined {
		let fd;
		try {
			fd = openSync(path, 'a+');
			return new FileLock({ fd, mode: 'shared' });
		} catch (error) {
			return undefined;
		} finally {
			if (fd !== undefined) {
				try {
					closeSync(fd);
				} catch (error) {
					logger.error(
						'Error closing locking file descriptor',
						error
					);
				}
			}
		}
	}

	private nativeLock: NativeLock;
	private wholeFileLock: WholeFileLock;
	private rangeLocks: FileLockIntervalTree;

	private constructor(nativeLock: NativeLock) {
		this.nativeLock = nativeLock;
		this.rangeLocks = new FileLockIntervalTree();
		this.wholeFileLock = { type: 'unlocked' };
	}

	// TODO: Replace this with a Symbol.dispose property once supported by all JS runtimes.
	dispose() {
		try {
			// Closing the file will release its lock
			closeSync(this.nativeLock.fd);
		} catch (error) {
			logger.error('Error closing locking file descriptor', error);
		}
	}

	// TODO: Comment reasoning
	// TODO: Replace lock on a redundant fd with a desired lock by the same process
	// TODO: Document the need for a native file descriptor
	lockWholeFile(op: WholeFileLockOp): boolean {
		if (op.type === 'unlock') {
			const originalType = this.wholeFileLock.type;
			if (originalType === 'unlocked') {
				// Do nothing because the whole file is already unlocked.
			} else if (
				this.wholeFileLock.type === 'exclusive' &&
				this.wholeFileLock.pid === op.pid &&
				this.wholeFileLock.fd === op.fd
			) {
				this.wholeFileLock = { type: 'unlocked' };
			} else if (
				this.wholeFileLock.type === 'shared' &&
				this.wholeFileLock.pidFds.has(op.pid) &&
				this.wholeFileLock.pidFds.get(op.pid)!.has(op.fd)
			) {
				this.wholeFileLock.pidFds.get(op.pid)!.delete(op.fd);
				if (this.wholeFileLock.pidFds.get(op.pid)!.size === 0) {
					this.wholeFileLock.pidFds.delete(op.pid);
				}
			}

			const minimumRequiredNativeLockType =
				this.getMinimumRequiredNativeLockType();
			if (
				this.nativeLock.mode === 'exclusive' &&
				minimumRequiredNativeLockType === 'shared'
			) {
				try {
					nativeFlockSync(this.nativeLock.fd, 'shnb');
					this.nativeLock.mode = 'shared';
				} catch {
					// TODO: What to do here? Something went badly wrong. Runtime exception?
				}
			}
			return true;
		}

		if (op.type === 'exclusive') {
			const thereIsAConflictingWholeFileLock =
				(this.wholeFileLock.type === 'exclusive' &&
					!(
						this.wholeFileLock.pid === op.pid &&
						this.wholeFileLock.fd === op.fd
					)) ||
				(this.wholeFileLock.type === 'shared' &&
					!(
						this.wholeFileLock.pidFds.size === 1 &&
						this.wholeFileLock.pidFds.has(op.pid) &&
						this.wholeFileLock.pidFds.get(op.pid)!.size === 1 &&
						this.wholeFileLock.pidFds.get(op.pid)!.has(op.fd)
					));
			const thereAreConflictingRangeLocks =
				this.rangeLocks.areThereLocksForOtherFileDescriptors(
					op.pid,
					op.fd
				);

			if (
				thereIsAConflictingWholeFileLock ||
				thereAreConflictingRangeLocks
			) {
				return false;
			}

			if (this.nativeLock.mode === 'shared') {
				try {
					nativeFlockSync(this.nativeLock.fd, 'exnb');
					this.nativeLock.mode = 'exclusive';
				} catch (error) {
					// We cannot obtain a native exclusive file lock,
					// so we cannot allow an exclusive file lock internally.
					return false;
				}
			}

			this.wholeFileLock = {
				type: 'exclusive',
				pid: op.pid,
				fd: op.fd,
			};

			return true;
		}

		if (op.type === 'shared') {
			const thereIsAConflictingWholeFileLock =
				this.wholeFileLock.type === 'exclusive' &&
				!(
					this.wholeFileLock.pid === op.pid &&
					this.wholeFileLock.fd === op.fd
				);
			const thereAreConflictingRangeLocks =
				this.rangeLocks.areThereLocksForOtherFileDescriptors(
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

			if (
				this.wholeFileLock.type === 'unlocked' ||
				(this.wholeFileLock.type === 'exclusive' &&
					this.wholeFileLock.pid === op.pid)
			) {
				if (this.nativeLock.mode === 'exclusive') {
					try {
						nativeFlockSync(this.nativeLock.fd, 'shnb');
						this.nativeLock.mode = 'shared';
					} catch {
						// TODO: What to do here? Something went badly wrong. Runtime exception?
					}
				}

				this.wholeFileLock = {
					type: 'shared',
					pidFds: new Map(),
				};
			}

			const sharedLock = this.wholeFileLock as WholeFileLock_Shared;
			if (!sharedLock.pidFds.has(op.pid)) {
				sharedLock.pidFds.set(op.pid, new Set());
			}
			sharedLock.pidFds.get(op.pid)!.add(op.fd);
			return true;
		}

		throw new Error(`Unexpected wholeFileLock() op: '${op.type}'`);
	}

	// TODO: Document the need for a native file descriptor
	lockFileByteRange(requestedLock: LockRangeWithType): boolean {
		// TODO: Add some predicates to make this more readable
		if (
			this.wholeFileLock.type === 'exclusive' &&
			this.wholeFileLock.pid !== requestedLock.pid
		) {
			// Any exclusive lock not owned by the same process and file descriptor
			// conflicts with this request.
			return false;
		}
		if (
			requestedLock.type === 'exclusive' &&
			this.wholeFileLock.type === 'shared' &&
			!(
				this.wholeFileLock.pidFds.size === 1 &&
				this.wholeFileLock.pidFds.has(requestedLock.pid) &&
				this.wholeFileLock.pidFds.get(requestedLock.pid)!.size === 1 &&
				this.wholeFileLock.pidFds
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
		const rangeLocks = this.rangeLocks;
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
			return false;
		}

		if (
			requestedLock.type === 'shared' &&
			overlappingLocksFromOthers.some((lock) => lock.type === 'exclusive')
		) {
			// The requested shared lock conflicts with an existing exclusive
			// lock from another process.
			return false;
		}

		if (
			this.nativeLock.mode === 'shared' &&
			requestedLock.type === 'exclusive'
		) {
			try {
				nativeFlockSync(this.nativeLock.fd, 'exnb');
				this.nativeLock.mode = 'exclusive';
			} catch {
				// An external exclusive lock conflicts with the requested lock.
				return false;
			}
		}

		// Remove overlapping locks from the same process because the requested
		// lock replaces them.
		for (const overlappingLock of overlappingLocksFromSameProcess) {
			rangeLocks.remove(overlappingLock);
		}

		rangeLocks.insert(requestedLock);

		return true;
	}

	// TODO: Consider unifying unlockFileByteRange and lockFileByteRange
	unlockFileByteRange(lockToRelease: LockRange) {
		// Unlock all overlapping locks from the same process.
		// TODO: What should happen to partial overlaps?
		const overlappingLocks = this.rangeLocks.findOverlapping(lockToRelease);
		const overlappingLocksFromSameProcess = overlappingLocks.filter(
			(lock) => lock.pid === lockToRelease.pid
		);
		for (const overlappingRangeLock of overlappingLocksFromSameProcess) {
			this.rangeLocks.remove(overlappingRangeLock);
		}

		const minimumRequiredNativeLockType =
			this.getMinimumRequiredNativeLockType();
		if (
			this.nativeLock.mode === 'exclusive' &&
			minimumRequiredNativeLockType === 'shared'
		) {
			try {
				nativeFlockSync(this.nativeLock.fd, 'shnb');
				this.nativeLock.mode = 'shared';
			} catch {
				// TODO: What to do here? Something went badly wrong. Runtime exception?
			}
		}
	}

	// TODO: Handle whole file lock case
	// TODO: Handle response for external conflicting lock
	findFirstConflictingByteRangeLock(
		desiredLock: LockRangeWithType
	): LockRangeWithType | undefined {
		const overlappingLocks = this.rangeLocks.findOverlapping(desiredLock);
		const firstConflictingLock = overlappingLocks.find(
			// TODO: Document why we are not checking for fd equality
			(lock) => lock.pid !== desiredLock.pid
		);

		if (firstConflictingLock) {
			return firstConflictingLock;
		}

		return undefined;
	}

	findRangeLocksForProcess(pid: Pid): LockRangeWithType[] {
		return this.rangeLocks.findLocksForProcess(pid);
	}

	releaseLocksForProcess(pid: Pid) {
		for (const rangeLock of this.rangeLocks.findLocksForProcess(pid)) {
			this.unlockFileByteRange(rangeLock);
		}

		if (
			this.wholeFileLock.type === 'exclusive' &&
			this.wholeFileLock.pid === pid
		) {
			this.lockWholeFile({
				pid,
				fd: this.wholeFileLock.fd,
				type: 'unlock',
			});
		} else if (
			this.wholeFileLock.type === 'shared' &&
			this.wholeFileLock.pidFds.has(pid)
		) {
			for (const fd of this.wholeFileLock.pidFds.get(pid)!) {
				this.lockWholeFile({
					pid,
					fd,
					type: 'unlock',
				});
			}
		}
	}

	releaseLocksForProcessFd(pid: Pid, fd: Fd) {
		// According to
		// https://chris.improbable.org/2010/12/16/everything-you-never-wanted-to-know-about-file-locking/
		// "If you open both databases in sqlite at the same time, then close the second one, all your open sqlite locks on the first one will be lost!"
		// TODO: Confirm and find better reference.
		// Closing an fd for a file releases all fcntl locks for the owning process.
		for (const rangeLock of this.rangeLocks.findLocksForProcess(pid, fd)) {
			this.unlockFileByteRange(rangeLock);
		}

		this.lockWholeFile({
			pid,
			fd,
			type: 'unlock',
		});
	}

	isUnlocked(): boolean {
		return (
			this.wholeFileLock.type === 'unlocked' && this.rangeLocks.isEmpty()
		);
	}

	private getMinimumRequiredNativeLockType() {
		if (this.wholeFileLock.type === 'exclusive') {
			return 'exclusive';
		}

		return 'shared';
	}

	private hasExclusiveRangeLockInNode(node: IntervalNode | null): boolean {
		if (!node) {
			return false;
		}

		if (node.range.type === 'exclusive') {
			return true;
		}

		return (
			this.hasExclusiveRangeLockInNode(node.left) ||
			this.hasExclusiveRangeLockInNode(node.right)
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
	// TODO: Document the need for a native file descriptor
	lockWholeFile(path: string, op: WholeFileLockOp): boolean {
		// console.log('wholeFileLock', path, op);
		if (this.locks.get(path) === undefined) {
			if (op.type === 'unlock') {
				return true;
			}

			const maybeLock = FileLock.create(path, op.type);
			if (maybeLock === undefined) {
				return false;
			}
			this.locks.set(path, maybeLock);
		}

		const lock = this.locks.get(path)!;
		const result = lock.lockWholeFile(op);
		this.forgetPathIfUnlocked(path);
		return result;
	}

	// TODO: Document the need for a native file descriptor
	lockFileByteRange(path: string, requestedLock: LockRangeWithType): boolean {
		if (!this.locks.has(path)) {
			const maybeLock = FileLock.create(path, requestedLock.type);
			if (maybeLock === undefined) {
				return false;
			}
			this.locks.set(path, maybeLock);
		}
		const lock = this.locks.get(path)!;
		return lock.lockFileByteRange(requestedLock);
	}

	// TODO: Consider unifying unlockFileByteRange and lockFileByteRange
	unlockFileByteRange(path: string, lockToRelease: LockRange) {
		const lock = this.locks.get(path);
		if (lock === undefined) {
			// TODO: Log an error
			return;
		}

		const result = lock.unlockFileByteRange(lockToRelease);
		this.forgetPathIfUnlocked(path);
		return result;
	}

	findFirstConflictingByteRangeLock(
		path: string,
		desiredLock: LockRangeWithType
	): LockRangeWithType | undefined {
		const lock = this.locks.get(path);
		if (lock === undefined) {
			return undefined;
		}
		return lock.findFirstConflictingByteRangeLock(desiredLock);
	}

	releaseLocksForProcess(pid: number) {
		//logger.log('releaseLocksForProcess', pid);
		for (const [path, lock] of this.locks.entries()) {
			lock.releaseLocksForProcess(pid);
			this.forgetPathIfUnlocked(path);
		}
	}

	releaseLocksForProcessFd(pid: number, fd: number, path: string) {
		// console.log('releaseLocksForProcessFd', pid, fd, path);
		const lock = this.locks.get(path);
		if (!lock) {
			return;
		}
		lock.releaseLocksForProcessFd(pid, fd);
		this.forgetPathIfUnlocked(path);
	}

	private forgetPathIfUnlocked(path: string) {
		const lock = this.locks.get(path);
		if (!lock) {
			return;
		}

		if (lock.isUnlocked()) {
			lock.dispose();
			this.locks.delete(path);
		}
	}
}
