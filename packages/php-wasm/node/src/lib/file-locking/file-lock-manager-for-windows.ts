// TODO: Add these types to the fs-ext-extra-prebuilt package.
import {
	lockFileExSync,
	unlockFileExSync,
	constants,
} from 'fs-ext-extra-prebuilt';
import { logger } from '@php-wasm/logger';
import type {
	FileLockManager,
	WholeFileLockOp,
	RequestedRangeLock,
	Pid,
	Fd,
	Path,
} from '@php-wasm/universal';

export class FileLockManagerForWindows implements FileLockManager {
	// TODO: Move path of whole file lock into leaf. It is never used for lookup.
	wholeFileLockMap = new Map<Path, Map<Pid, Map<Fd, WholeFileLockOp>>>();

	rangeLockedFds = new Map<Pid, Map<Path, Set<Fd>>>();

	lockWholeFile(path: string, op: WholeFileLockOp): boolean {
		// For whole-file locks, we address the entire byte range of the file.
		// TODO: Consider converting the exposed Win API to just use bigint for offset and length.
		const offsetLow = 0;
		const offsetHigh = 0;
		const lengthLow = 0xffffffff;
		const lengthHigh = 0xffffffff;

		if (op.type === 'unlock') {
			// TODO: Should we skip unlocking if we do not have record of the lock?

			// TODO: Catch errors
			const result = unlockFileExSync(
				op.fd,
				offsetLow,
				offsetHigh,
				lengthLow,
				lengthHigh
			);

			if (result) {
				this.wholeFileLockMap.get(path)?.get(op.pid)?.delete(op.fd);
				if (this.wholeFileLockMap.get(path)?.get(op.pid)?.size === 0) {
					this.wholeFileLockMap.get(path)?.delete(op.pid);
				}
				if (this.wholeFileLockMap.get(path)?.size === 0) {
					this.wholeFileLockMap.delete(path);
				}
			}

			// TODO: Else if unlock failed in Windows, probably log an error.
			return result;
		} else {
			const preexistingLock = this.wholeFileLockMap
				.get(path)
				?.get(op.pid)
				?.get(op.fd);
			if (op.type === preexistingLock?.type) {
				// There is nothing to do.
				return true;
			}

			let flags = 0;
			if (!op.waitForLock) {
				flags |= constants.LOCKFILE_FAIL_IMMEDIATELY;
			}

			let lockResult;
			if (op.type === 'shared') {
				/**
				 * Since we are requesting a shared lock, we can obtain it first
				 * even if we already hold the exclusive lock.
				 *
				 * "Shared locks can overlap a locked region provided locks held
				 * on that region are shared locks. A shared lock can overlap an
				 * exclusive lock if both locks were created using the same file handle."
				 * @see https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-lockfileex
				 */
				lockResult = lockFileExSync(
					op.fd,
					flags,
					offsetLow,
					offsetHigh,
					lengthLow,
					lengthHigh
				);

				if (lockResult && preexistingLock?.type === 'exclusive') {
					const exclusiveUnlockResult = unlockFileExSync(
						op.fd,
						offsetLow,
						offsetHigh,
						lengthLow,
						lengthHigh
					);

					if (!exclusiveUnlockResult) {
						// This should never happen. Log and throw an error.
						const message =
							'Failed to unlock preexisting exclusive lock after failing to obtain shared lock';
						logger.error(message);
						throw new Error(message);
					}
				}
			}

			if (op.type === 'exclusive') {
				flags |= constants.LOCKFILE_EXCLUSIVE_LOCK;

				let sharedUnlockResult;
				if (preexistingLock?.type === 'shared') {
					sharedUnlockResult = unlockFileExSync(
						op.fd,
						offsetLow,
						offsetHigh,
						lengthLow,
						lengthHigh
					);
					// TODO: Log if there's an error
				}

				lockResult = lockFileExSync(
					op.fd,
					flags,
					offsetLow,
					offsetHigh,
					lengthLow,
					lengthHigh
				);
				// TODO: Log if there's an error

				if (!lockResult && sharedUnlockResult) {
					/*
					 * We failed to obtain the exclusive lock but already
					 * dropped the shared lock because preexisting shared locks
					 * will block the exclusive lock.
					 *
					 * "If an exclusive lock is requested for a range of a file that
					 * already has a shared or exclusive lock, the function returns
					 * the error ERROR_IO_PENDING."
					 * @see https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-lockfileex
					 */
					const sharedReLockResult = lockFileExSync(
						op.fd,
						// Wait to restore the shared lock.
						0,
						offsetLow,
						offsetHigh,
						lengthLow,
						lengthHigh
					);

					if (!sharedReLockResult) {
						// This should never happen. Log and throw an error.
						const message =
							'Failed to re-lock preexisting shared lock after failing to obtain exclusive lock';
						logger.error(message);
						throw new Error(message);
					}
				}
			}

			if (lockResult) {
				if (!this.wholeFileLockMap.has(path)) {
					this.wholeFileLockMap.set(path, new Map());
				}
				const pidMap = this.wholeFileLockMap.get(path)!;
				if (!pidMap.has(op.pid)) {
					pidMap.set(op.pid, new Map());
				}
				const pathMap = pidMap.get(op.pid)!;
				pathMap.set(op.fd, op);
			}

			return !!lockResult;
		}
	}

	lockFileByteRange(
		path: string,
		op: RequestedRangeLock,
		waitForLock: boolean
	): boolean {
		const offsetLow = Number(op.start & 0xffffffffn);
		const offsetHigh = Number((op.start >> 32n) & 0xffffffffn);
		const lengthLow = Number(op.end & 0xffffffffn);
		const lengthHigh = Number((op.end >> 32n) & 0xffffffffn);

		// TODO: Track locked ranges
		// TODO: Make sure zero length ranges are treated as covering the entire remaining range.

		// TODO: Add exception handling for Sync calls.
		if (op.type === 'unlocked') {
			return unlockFileExSync(
				op.fd,
				offsetLow,
				offsetHigh,
				lengthLow,
				lengthHigh
			);
		} else {
			let flags = 0;
			if (op.type === 'exclusive') {
				flags |= constants.LOCKFILE_EXCLUSIVE_LOCK;
			}
			if (!waitForLock) {
				flags |= constants.LOCKFILE_FAIL_IMMEDIATELY;
			}
			return lockFileExSync(
				op.fd,
				flags,
				offsetLow,
				offsetHigh,
				lengthLow,
				lengthHigh
			);
		}
	}

	findFirstConflictingByteRangeLock(
		path: string,
		op: RequestedRangeLock
	): ReturnType<FileLockManager['findFirstConflictingByteRangeLock']> {
		if (op.type === 'unlocked') {
			return undefined;
		}

		// With Windows, we cannot query existing locks,
		// but we can try to lock the requested range.
		const obtainedLock = this.lockFileByteRange(path, op, false);
		if (!obtainedLock) {
			return undefined;
		}

		// There is a conflicting lock. Since we cannot directly query
		// what lock conflicts, let's report that the entire range is locked.
		// TODO: Explain why this seems better than reporting there is an exactly conflicting lock.
		this.lockFileByteRange(path, { ...op, type: 'unlocked' }, true);
		return {
			type: 'exclusive',
			start: 0n,
			end: 0xffffffff_ffffffffn,
			pid: -1,
		};
	}

	releaseLocksForProcess(targetPid: number): void {
		// TODO: Implement tracking of locks held by a process and release them.
		for (const [path, pidMap] of this.wholeFileLockMap.entries()) {
			const fdMap = pidMap.get(targetPid);
			if (!fdMap) {
				continue;
			}

			for (const op of fdMap.values()) {
				// TODO: Log any errors.
				// TODO: Does a failure here justify throwing an error (and conceding total brokenness)?
				this.lockWholeFile(path, { ...op, type: 'unlock' });
			}

			pidMap.delete(targetPid);
		}

		// TODO: Implement release of range locks.
	}

	// TODO: Rename this to something clearer like releaseLockOnFileDescriptorClose
	releaseLocksOnFdClose(
		targetPid: number,
		targetFd: number,
		targetPath: string
	): void {
		// Do nothing because the native OS is responsible for releasing
		// whole-file locks when the FD is closed.

		this.wholeFileLockMap.get(targetPath)?.get(targetPid)?.delete(targetFd);

		// TODO: Once we implement proper ranged fcntl()-based locks,
		// release all locks for the given PID and path when the FD is closed.
		// fcntl()-based locks are released whenever any file descriptor for the
		// target file is closed, regardless of which FD was used to obtain the lock.

		this.rangeLockedFds.get(targetPid)?.delete(targetPath);

		// TODO: Implement POSIX fcntl() semantics where a lock is released
		// when any FD associated with the file is closed.
	}
}
