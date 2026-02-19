import type {
	FileLockManager,
	RequestedRangeLock,
	WholeFileLock,
	WholeFileLockOp,
	Pid,
	Fd,
} from './file-lock-manager';
import {
	MAX_ADDRESSABLE_FILE_OFFSET,
	type LockedRange,
} from './file-lock-manager';
import { FileLockIntervalTree } from './file-lock-interval-tree';

/**
 * This is the file lock manager for use within JS runtimes like Node.js.
 *
 * A FileLockManagerInMemory is a wrapper around a Map of FileLock instances.
 * It provides methods for locking and unlocking files, as well as finding conflicting locks.
 */
export class FileLockManagerInMemory implements FileLockManager {
	locks: Map<string, FileLock>;

	/**
	 * Create a new FileLockManagerInMemory instance.
	 *
	 * @param nativeFlockSync A synchronous flock() function to lock files via the host OS.
	 */
	constructor() {
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
	lockWholeFile(
		path: string,
		/**
		 * NOTE: FileLockManagerInMemory does not support waiting for a lock
		 * because it is intended to be used with a native file lock manager
		 * which does support waiting.
		 */
		op: Omit<WholeFileLockOp, 'waitForLock'>
	): boolean {
		if (this.locks.get(path) === undefined) {
			if (op.type === 'unlock') {
				return true;
			}

			this.locks.set(path, new FileLock());
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
		/**
		 * NOTE: fcntl()-style F_SETLK/F_GETLK do not associate
		 * resulting locks with a file descrtiptor, so we ignore fd here.
		 */
		requestedLock: Omit<RequestedRangeLock, 'fd'>
		/**
		 * NOTE: FileLockManagerInMemory does not support waiting for a lock
		 * because it is intended to be used with a native file lock manager
		 * which does support waiting.
		 */
		// waitForLock: boolean,
	): boolean {
		if (!this.locks.has(path)) {
			if (requestedLock.type === 'unlocked') {
				// There is no existing lock. This is a no-op.
				return true;
			}

			this.locks.set(path, new FileLock());
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
		/**
		 * NOTE: fcntl()-style F_SETLK/F_GETLK do not associate
		 * resulting locks with a file descrtiptor, so we ignore fd here.
		 */
		desiredLock: Omit<RequestedRangeLock, 'fd'>
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
	releaseLocksOnFdClose(pid: number, fd: number, nativePath: string) {
		const lock = this.locks.get(nativePath);
		if (!lock) {
			return;
		}
		lock.releaseLocksOnFdClose(pid, fd);
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
	private wholeFileLock: WholeFileLock;
	private rangeLocks: FileLockIntervalTree;

	constructor() {
		this.rangeLocks = new FileLockIntervalTree();
		this.wholeFileLock = { type: 'unlocked' };
	}

	/**
	 * Lock the whole file.
	 *
	 * This method corresponds to the flock() function.
	 *
	 * @param op The whole file lock operation to perform.
	 * @returns True if the lock was granted, false otherwise.
	 */
	lockWholeFile(op: Omit<WholeFileLockOp, 'waitForLock'>): boolean {
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

			return true;
		}

		if (this.isThereAConflictWithRequestedWholeFileLock(op)) {
			// The requested lock conflicts with an existing lock.
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
	lockFileByteRange(
		requestedLock: Omit<RequestedRangeLock, 'fd' | 'waitForLock'>
	): boolean {
		if (requestedLock.start === requestedLock.end) {
			/*
			 * Treat a range with zero length as covering the entire remaining range.
			 * POSIX Ref: https://pubs.opengroup.org/onlinepubs/9799919799/functions/fcntl.html
			 *   "A lock shall be set to extend to the largest possible value of the file offset
			 *    for that file by setting l_len to 0."
			 */
			requestedLock = {
				...requestedLock,
				end: MAX_ADDRESSABLE_FILE_OFFSET,
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

			return true;
		}

		if (this.isThereAConflictWithRequestedRangeLock(requestedLock)) {
			// A conflicting lock exists.
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
		/**
		 * NOTE: fcntl()-style F_SETLK/F_GETLK do not associate
		 * resulting locks with a file descrtiptor, so we ignore fd here.
		 */
		desiredLock: Omit<RequestedRangeLock, 'fd'>
	) {
		if (desiredLock.start === desiredLock.end) {
			/*
			 * Treat a range with zero length as covering the entire remaining range.
			 * POSIX Ref: https://pubs.opengroup.org/onlinepubs/9799919799/functions/fcntl.html
			 *   "A lock shall be set to extend to the largest possible value of the file offset
			 *    for that file by setting l_len to 0."
			 */
			desiredLock = {
				...desiredLock,
				end: MAX_ADDRESSABLE_FILE_OFFSET,
			};
		}
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
	releaseLocksOnFdClose(pid: Pid, fd: Fd) {
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
	 * Check if a lock exists that conflicts with the requested range lock.
	 *
	 * @param requestedLock The desired byte range lock.
	 * @returns True if a conflicting lock exists, false otherwise.
	 */
	private isThereAConflictWithRequestedRangeLock(
		requestedLock: Omit<RequestedRangeLock, 'fd' | 'waitForLock'>
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
		requestedLock: Omit<WholeFileLockOp, 'waitForLock'>
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
				start: 0n,
				end: MAX_ADDRESSABLE_FILE_OFFSET,
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
				start: 0n,
				end: MAX_ADDRESSABLE_FILE_OFFSET,
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
