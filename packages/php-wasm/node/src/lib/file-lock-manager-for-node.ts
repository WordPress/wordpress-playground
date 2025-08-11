import { logger } from '@php-wasm/logger';
import { openSync, closeSync } from 'fs';

type NativeFlockSync = (
	fd: number,
	flags: 'sh' | 'ex' | 'shnb' | 'exnb' | 'un'
) => void;

import type {
	FileLockManager,
	RequestedRangeLock,
	WholeFileLock,
	WholeFileLockOp,
	Pid,
	Fd,
} from './file-lock-manager';

type LockMode = 'exclusive' | 'shared' | 'unlock';

type NativeLock = {
	fd: number;
	mode: LockMode;
	nativeFlockSync: NativeFlockSync;
};

type LockedRange = RequestedRangeLock & {
	type: Exclude<RequestedRangeLock['type'], 'unlocked'>;
};

const MAX_64BIT_OFFSET = BigInt(2n ** 64n - 1n);

/**
 * This is the file lock manager for use within JS runtimes like Node.js.
 *
 * A FileLockManagerForNode is a wrapper around a Map of FileLock instances.
 * It provides methods for locking and unlocking files, as well as finding conflicting locks.
 */
export class FileLockManagerForNode implements FileLockManager {
	nativeFlockSync: NativeFlockSync;
	locks: Map<string, FileLock>;

	/**
	 * Create a new FileLockManagerForNode instance.
	 *
	 * @param nativeFlockSync A synchronous flock() function to lock files via the host OS.
	 */
	constructor(
		nativeFlockSync: NativeFlockSync = function flockSyncNoOp() {
			/* do nothing */
		}
	) {
		this.nativeFlockSync = nativeFlockSync;
		this.locks = new Map();
	}

	/**
	 * Lock the whole file.
	 *
	 * @param path The path to the file to lock. This should be the path
	 *             of the file in the native filesystem.
	 * @param op The whole file lock operation to perform.
	 * @returns True if the lock was granted, false otherwise.
	 */
	lockWholeFile(path: string, op: WholeFileLockOp): boolean {
		if (this.locks.get(path) === undefined) {
			if (op.type === 'unlock') {
				return true;
			}

			const maybeLock = FileLock.maybeCreate(
				path,
				op.type,
				this.nativeFlockSync
			);
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

	/**
	 * Lock a byte range.
	 *
	 * @param path The path to the file to lock. This should be the path
	 *             of the file in the native filesystem.
	 * @param requestedLock The byte range lock to perform.
	 * @returns True if the lock was granted, false otherwise.
	 */
	lockFileByteRange(
		path: string,
		requestedLock: RequestedRangeLock
	): boolean {
		if (!this.locks.has(path)) {
			if (requestedLock.type === 'unlocked') {
				// There is no existing lock. This is a no-op.
				return true;
			}

			const maybeLock = FileLock.maybeCreate(
				path,
				requestedLock.type,
				this.nativeFlockSync
			);
			if (maybeLock === undefined) {
				return false;
			}
			this.locks.set(path, maybeLock);
		}
		const lock = this.locks.get(path)!;
		return lock.lockFileByteRange(requestedLock);
	}

	/**
	 * Find the first conflicting byte range lock.
	 *
	 * @param path The path to the file to find the conflicting lock for.
	 * @param desiredLock The desired byte range lock.
	 * @returns The first conflicting byte range lock, or undefined if no conflicting lock exists.
	 */
	findFirstConflictingByteRangeLock(
		path: string,
		desiredLock: RequestedRangeLock
	): Omit<RequestedRangeLock, 'fd'> | undefined {
		const lock = this.locks.get(path);
		if (lock === undefined) {
			return undefined;
		}
		return lock.findFirstConflictingByteRangeLock(desiredLock);
	}

	/**
	 * Release all locks for the given process.
	 *
	 * @param pid The process ID to release locks for.
	 */
	releaseLocksForProcess(pid: number) {
		//logger.log('releaseLocksForProcess', pid);
		for (const [path, lock] of this.locks.entries()) {
			lock.releaseLocksForProcess(pid);
			this.forgetPathIfUnlocked(path);
		}
	}

	/**
	 * Release all locks for the given process and file descriptor.
	 *
	 * @param pid The process ID to release locks for.
	 * @param fd The file descriptor to release locks for.
	 * @param path The path to the file to release locks for.
	 */
	releaseLocksForProcessFd(pid: number, fd: number, nativePath: string) {
		const lock = this.locks.get(nativePath);
		if (!lock) {
			return;
		}
		lock.releaseLocksForProcessFd(pid, fd);
		this.forgetPathIfUnlocked(nativePath);
	}

	/**
	 * Forget the path if it is unlocked.
	 *
	 * @param path The path to the file to forget.
	 */
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

/**
 * A FileLock instance encapsulates a native whole-file lock and file locking between
 * php-wasm processes.
 *
 * A FileLock supports php-wasm whole-file locks and byte range locks.
 * Before granting a php-wasm lock, a FileLock ensures that it first holds a compatible
 * native lock. If a compatible native lock cannot be acquired, the php-wasm lock is
 * not granted.
 */
export class FileLock {
	/**
	 * Create a new FileLock instance for the given file and mode.
	 * Fail if the underlying native file lock cannot be acquired.
	 *
	 * @param path The path to the file to lock
	 * @param mode The type of lock to acquire
	 * @returns A FileLock instance if the lock was acquired, undefined otherwise
	 */
	static maybeCreate(
		path: string,
		mode: Exclude<WholeFileLock['type'], 'unlocked'>,
		nativeFlockSync: NativeFlockSync
	): FileLock | undefined {
		let fd;
		try {
			fd = openSync(path, 'a+');

			const flockFlags = mode === 'exclusive' ? 'exnb' : 'shnb';
			nativeFlockSync(fd, flockFlags);

			const nativeLock: NativeLock = { fd, mode, nativeFlockSync };
			return new FileLock(nativeLock);
		} catch {
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
			return undefined;
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

	/**
	 * Close the file descriptor and release the native lock.
	 *
	 * @TODO Replace this with a Symbol.dispose property once supported by all JS runtimes.
	 */
	dispose() {
		try {
			// Closing the file will release its lock
			closeSync(this.nativeLock.fd);
		} catch (error) {
			logger.error('Error closing locking file descriptor', error);
		}
	}

	/**
	 * Lock the whole file.
	 *
	 * This method corresponds to the flock() function.
	 *
	 * @param op The whole file lock operation to perform.
	 * @returns True if the lock was granted, false otherwise.
	 */
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

				if (this.wholeFileLock.pidFds.size === 0) {
					this.wholeFileLock = { type: 'unlocked' };
				}
			}

			// Make sure we only hold the minimum required native lock.
			if (!this.ensureCompatibleNativeLock()) {
				logger.error(
					'Unable to update native lock after removing a whole file lock.'
				);
			}

			return true;
		}

		if (this.isThereAConflictWithRequestedWholeFileLock(op)) {
			// The requested lock conflicts with an existing lock.
			return false;
		}

		if (
			!this.ensureCompatibleNativeLock({
				overrideWholeFileLockType: op.type,
			})
		) {
			// We cannot acquire a native lock that is compatible with the requested lock.
			// An external process may be holding a conflicting lock.
			return false;
		}

		if (op.type === 'exclusive') {
			this.wholeFileLock = {
				type: 'exclusive',
				pid: op.pid,
				fd: op.fd,
			};

			return true;
		}

		if (op.type === 'shared') {
			if (this.wholeFileLock.type !== 'shared') {
				this.wholeFileLock = {
					type: 'shared',
					pidFds: new Map(),
				};
			}

			const sharedLock = this.wholeFileLock;
			if (!sharedLock.pidFds.has(op.pid)) {
				sharedLock.pidFds.set(op.pid, new Set());
			}
			sharedLock.pidFds.get(op.pid)!.add(op.fd);

			return true;
		}

		throw new Error(`Unexpected wholeFileLock() op: '${op.type}'`);
	}

	/**
	 * Lock a byte range.
	 *
	 * This method corresponds to the fcntl() F_SETLK command.
	 *
	 * @param requestedLock The byte range lock to perform.
	 * @returns True if the lock was granted, false otherwise.
	 */
	lockFileByteRange(requestedLock: RequestedRangeLock): boolean {
		if (requestedLock.start === requestedLock.end) {
			/*
			 * Treat a range with zero length as covering the entire remaining range.
			 * POSIX Ref: https://pubs.opengroup.org/onlinepubs/9799919799/functions/fcntl.html
			 *   "A lock shall be set to extend to the largest possible value of the file offset
			 *    for that file by setting l_len to 0."
			 */
			requestedLock = {
				...requestedLock,
				end: MAX_64BIT_OFFSET,
			};
		}

		if (requestedLock.type === 'unlocked') {
			const overlappingLocksBySameProcess = this.rangeLocks
				.findOverlapping(requestedLock)
				.filter((lock) => lock.pid === requestedLock.pid);

			for (const overlappingLock of overlappingLocksBySameProcess) {
				this.rangeLocks.remove(overlappingLock);

				if (overlappingLock.start < requestedLock.start) {
					// This lock precedes our unlock range.
					// Preserve the part that does not overlap.
					this.rangeLocks.insert({
						...overlappingLock,
						end: requestedLock.start,
					});
				}

				if (overlappingLock.end > requestedLock.end) {
					// This lock extends past our unlock range.
					// Preserve the part that does not overlap.
					this.rangeLocks.insert({
						...overlappingLock,
						start: requestedLock.end,
					});
				}
			}

			// Make sure we only hold the minimum required native lock.
			if (!this.ensureCompatibleNativeLock()) {
				logger.error(
					'Unable to update native lock after removing a byte range lock.'
				);
			}

			return true;
		}

		if (this.isThereAConflictWithRequestedRangeLock(requestedLock)) {
			// A conflicting lock exists.
			return false;
		}

		if (
			!this.ensureCompatibleNativeLock({
				overrideRangeLockType: requestedLock.type,
			})
		) {
			// We cannot acquire a native lock that is compatible with the requested lock.
			// An external process may be holding a conflicting lock.
			return false;
		}

		const overlappingLocksFromSameProcess = this.rangeLocks
			.findOverlapping(requestedLock)
			.filter((lock) => lock.pid === requestedLock.pid);

		let minStart = requestedLock.start;
		let maxEnd = requestedLock.end;
		for (const overlappingLock of overlappingLocksFromSameProcess) {
			// Remove overlapping locks from the same process because the requested
			// lock replaces them.
			this.rangeLocks.remove(overlappingLock);

			if (overlappingLock.start < minStart) {
				minStart = overlappingLock.start;
			}
			if (overlappingLock.end > maxEnd) {
				maxEnd = overlappingLock.end;
			}
		}

		// Overlapping locks from the same process are merged into a single lock of the requested type.
		const mergedLock: LockedRange = {
			...(requestedLock as LockedRange),
			start: minStart,
			end: maxEnd,
		};
		this.rangeLocks.insert(mergedLock);

		return true;
	}

	/**
	 * Find the first conflicting byte range lock.
	 *
	 * This method corresponds to the fcntl() F_GETLK command.
	 *
	 * @param desiredLock The desired byte range lock.
	 * @returns The first conflicting byte range lock, or undefined if no conflicting lock exists.
	 */
	findFirstConflictingByteRangeLock(
		desiredLock: RequestedRangeLock
	): RequestedRangeLock | undefined {
		const overlappingLocks = this.rangeLocks.findOverlapping(desiredLock);
		const firstConflictingRangeLock = overlappingLocks.find(
			(lock) =>
				lock.pid !== desiredLock.pid &&
				(desiredLock.type === 'exclusive' || lock.type === 'exclusive')
		);

		if (firstConflictingRangeLock) {
			return firstConflictingRangeLock;
		}

		if (this.wholeFileLock.type === 'unlocked') {
			return undefined;
		}

		const wfl = this.wholeFileLock;
		if (wfl.type === 'exclusive' || desiredLock.type === 'exclusive') {
			// An exclusive lock conflicts with any other exclusive lock.
			return {
				type: this.wholeFileLock.type,
				start: 0n,
				end: 0n,
				pid: -1,
			};
		}

		// Shared locks do not conflict with each other.
		return undefined;
	}

	/**
	 * Release all locks for the given process.
	 *
	 * @param pid The process ID to release locks for.
	 */
	releaseLocksForProcess(pid: Pid) {
		for (const rangeLock of this.rangeLocks.findLocksForProcess(pid)) {
			this.lockFileByteRange({
				...rangeLock,
				type: 'unlocked',
			});
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

	/**
	 * Release all locks for the given process and file descriptor.
	 *
	 * @param pid The process ID to release locks for.
	 * @param fd The file descriptor to release locks for.
	 */
	releaseLocksForProcessFd(pid: Pid, fd: Fd) {
		// Closing an fd for a file releases all fcntl locks for that file by the process.
		// POSIX Ref: https://pubs.opengroup.org/onlinepubs/9799919799/functions/fcntl.html
		//   "Closing a file descriptor shall release all locks held by the process on the file
		//    associated with that file descriptor."
		for (const rangeLock of this.rangeLocks.findLocksForProcess(pid)) {
			this.lockFileByteRange({
				...rangeLock,
				type: 'unlocked',
			});
		}

		this.lockWholeFile({
			pid,
			fd,
			type: 'unlock',
		});
	}

	/**
	 * Check if the file lock is unlocked.
	 *
	 * @returns True if the file lock is unlocked, false otherwise.
	 */
	isUnlocked(): boolean {
		return (
			this.wholeFileLock.type === 'unlocked' && this.rangeLocks.isEmpty()
		);
	}

	/**
	 * Ensure that the native lock is compatible with the php-wasm lock,
	 * upgrading or downgrading as needed.
	 *
	 * @param overrideWholeFileLockType If provided, use this type for the whole file lock.
	 * @param overrideRangeLockType If provided, use this type for the range lock.
	 * @returns True if the native lock was upgraded or downgraded, false otherwise.
	 */
	private ensureCompatibleNativeLock({
		overrideWholeFileLockType,
		overrideRangeLockType,
	}: {
		overrideWholeFileLockType?: WholeFileLock['type'];
		overrideRangeLockType?: RequestedRangeLock['type'];
	} = {}): boolean {
		const wholeFileLockType =
			overrideWholeFileLockType ?? this.wholeFileLock.type;
		const rangeLockType =
			overrideRangeLockType ??
			this.rangeLocks.findStrictestExistingLockType();

		let requiredNativeLockType: NativeLock['mode'];
		if (
			wholeFileLockType === 'exclusive' ||
			rangeLockType === 'exclusive'
		) {
			requiredNativeLockType = 'exclusive';
		} else if (
			wholeFileLockType === 'shared' ||
			rangeLockType === 'shared'
		) {
			requiredNativeLockType = 'shared';
		} else {
			requiredNativeLockType = 'unlock';
		}

		if (this.nativeLock.mode === requiredNativeLockType) {
			return true;
		}

		const flockFlags =
			(requiredNativeLockType === 'exclusive' && 'exnb') ||
			(requiredNativeLockType === 'shared' && 'shnb') ||
			'un';

		try {
			this.nativeLock.nativeFlockSync(this.nativeLock.fd, flockFlags);
			this.nativeLock.mode = requiredNativeLockType;
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Check if a lock exists that conflicts with the requested range lock.
	 *
	 * @param requestedLock The desired byte range lock.
	 * @returns True if a conflicting lock exists, false otherwise.
	 */
	private isThereAConflictWithRequestedRangeLock(
		requestedLock: RequestedRangeLock
	) {
		return (
			this.findFirstConflictingByteRangeLock(requestedLock) !== undefined
		);
	}

	/**
	 * Check if a lock exists that conflicts with the requested whole-file lock.
	 *
	 * @param requestedLock The desired whole-file lock.
	 * @returns True if a conflicting lock exists, false otherwise.
	 */
	private isThereAConflictWithRequestedWholeFileLock(
		requestedLock: WholeFileLockOp
	) {
		if (requestedLock.type === 'exclusive') {
			if (
				this.wholeFileLock.type === 'exclusive' &&
				(this.wholeFileLock.fd !== requestedLock.fd ||
					this.wholeFileLock.pid !== requestedLock.pid)
			) {
				return true;
			}
			if (
				this.wholeFileLock.type === 'shared' &&
				Array.from(this.wholeFileLock.pidFds).some(
					([pid]) => pid !== requestedLock.pid
				)
			) {
				return true;
			}

			const overlappingLocks = this.rangeLocks.findOverlapping({
				type: 'unlocked',
				start: 0n,
				end: MAX_64BIT_OFFSET,
				pid: -1,
			});
			if (overlappingLocks.length > 0) {
				// Any range lock, including one by the same process,
				// conflict with an exclusive whole-file lock.
				return true;
			}

			return false;
		}

		if (requestedLock.type === 'shared') {
			if (
				this.wholeFileLock.type === 'exclusive' &&
				this.wholeFileLock.pid !== requestedLock.pid
			) {
				return true;
			}

			const overlappingLocks = this.rangeLocks.findOverlapping({
				type: 'unlocked',
				start: 0n,
				end: MAX_64BIT_OFFSET,
				pid: -1,
			});
			const exclusiveRangeLocks = overlappingLocks.filter(
				(lock) => lock.type === 'exclusive'
			);
			if (exclusiveRangeLocks.length > 0) {
				// Any exclusive range lock, including one by the same process,
				// conflict with a shared whole-file lock.
				return true;
			}

			return false;
		}

		return false;
	}
}

class IntervalNode {
	range: LockedRange;
	max: bigint;
	left: IntervalNode | null = null;
	right: IntervalNode | null = null;

	constructor(range: LockedRange) {
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
	insert(range: LockedRange): void {
		this.root = this.insertNode(this.root, range);
	}

	/**
	 * Find all ranges that overlap with the given range
	 */
	findOverlapping(range: RequestedRangeLock): LockedRange[] {
		const result: LockedRange[] = [];
		this.findOverlappingRanges(this.root, range, result);
		return result;
	}

	/**
	 * Remove a lock range from the tree
	 */
	remove(range: RequestedRangeLock): void {
		this.root = this.removeNode(this.root, range);
	}

	/**
	 * Find all ranges locked by the given process.
	 *
	 * @param pid The process ID to find locks for.
	 * @returns All locked ranges for the given process.
	 */
	findLocksForProcess(pid: number): RequestedRangeLock[] {
		const result: RequestedRangeLock[] = [];
		this.findLocksForProcessInNode(this.root, pid, result);
		return result;
	}

	/**
	 * Find the strictest existing lock type in the range lock tree.
	 *
	 * @returns The strictest existing lock type, or 'unlocked' if no locks exist.
	 */
	findStrictestExistingLockType(): RequestedRangeLock['type'] {
		let maxType: RequestedRangeLock['type'] = 'unlocked';

		const traverse = (node: IntervalNode | null) => {
			if (!node) {
				return;
			}
			if (node.range.type === 'exclusive') {
				maxType = 'exclusive';
				return; // Can stop early since exclusive is highest
			}
			if (node.range.type === 'shared') {
				maxType = 'shared';
			}
			traverse(node.left);
			traverse(node.right);
		};
		traverse(this.root);

		return maxType;
	}

	private insertNode(
		node: IntervalNode | null,
		range: LockedRange
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

	private findOverlappingRanges(
		node: IntervalNode | null,
		range: RequestedRangeLock,
		result: LockedRange[]
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
		a: RequestedRangeLock,
		b: RequestedRangeLock
	): boolean {
		return a.start < b.end && b.start < a.end;
	}

	private removeNode(
		node: IntervalNode | null,
		range: RequestedRangeLock
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

	private areRangesEqual(
		a: RequestedRangeLock,
		b: RequestedRangeLock
	): boolean {
		return a.start === b.start && a.end === b.end && a.pid === b.pid;
	}

	private findLocksForProcessInNode(
		node: IntervalNode | null,
		pid: number,
		result: RequestedRangeLock[]
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
