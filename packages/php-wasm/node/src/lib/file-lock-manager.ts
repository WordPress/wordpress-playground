import { logger } from '@php-wasm/logger';
import { openSync, closeSync } from 'fs';
import { flockSync as nativeFlockSync } from 'fs-ext';

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
	end: bigint | Infinity;
	/** The process ID that owns this lock */
	pid: Pid;
	/** The file descriptor that owns this lock.
	 * Note: This is not needed for range locking but is needed to detect
	 * conflicts with whole file locks.
	 */
	fd: Fd;
};

export type LockRangeWithType = LockRange & {
	/** The type of lock ('shared' or 'exclusive') */
	type: 'shared' | 'exclusive';
};

export type WholeFileLock =
	| WholeFileLock_Exclusive
	| WholeFileLock_Shared
	| WholeFileLock_Unlocked;

export type Pid = number;
export type Fd = number;

export type WholeFileLock_Exclusive = {
	type: 'exclusive';
	pid: Pid;
	fd: Fd;
};
export type WholeFileLock_Shared = {
	type: 'shared';
	pidFds: Map<Pid, Set<Fd>>;
};
export type WholeFileLock_Unlocked = {
	type: 'unlocked';
};

export type WholeFileLockOp = {
	pid: number;
	fd: number;
	type: 'shared' | 'exclusive' | 'unlock';
};
