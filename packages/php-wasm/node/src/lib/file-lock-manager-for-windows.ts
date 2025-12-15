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
import { FileLockIntervalTree } from '@php-wasm/universal';

function tryLockFileExSync(
	fd: number,
	flags: number,
	offsetLow: number,
	offsetHigh: number,
	lengthLow: number,
	lengthHigh: number
): number {
	try {
		tryLockFileExSync(
			fd,
			flags,
			offsetLow,
			offsetHigh,
			lengthLow,
			lengthHigh
		);
		return 0;
	} catch (e) {
		console.error('Error in tryLockFileExSync:', e);
		return -1;
	}
}

function tryUnlockFileExSync(
	fd: number,
	offsetLow: number,
	offsetHigh: number,
	lengthLow: number,
	lengthHigh: number
): number {
	try {
		tryUnlockFileExSync(fd, offsetLow, offsetHigh, lengthLow, lengthHigh);
		return 0;
	} catch (e) {
		console.error('Error in tryUnlockFileExSync:', e);
		return -1;
	}
}

export class FileLockManagerForWindows implements FileLockManager {
	// TODO: Move path of whole file lock into leaf. It is never used for lookup.
	wholeFileLockMap = new Map<Path, Map<Pid, Map<Fd, WholeFileLockOp>>>();
	rangeLockedFds = new Map<Path, FileLockIntervalTree>();

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
			const result = tryUnlockFileExSync(
				op.fd,
				offsetLow,
				offsetHigh,
				lengthLow,
				lengthHigh
			);
			const success = result === 0;

			if (success) {
				this.wholeFileLockMap.get(path)?.get(op.pid)?.delete(op.fd);
				if (this.wholeFileLockMap.get(path)?.get(op.pid)?.size === 0) {
					this.wholeFileLockMap.get(path)?.delete(op.pid);
				}
				if (this.wholeFileLockMap.get(path)?.size === 0) {
					this.wholeFileLockMap.delete(path);
				}
			}

			// TODO: Else if unlock failed in Windows, probably log an error.
			return success;
		}

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

		let success;
		if (op.type === 'shared') {
			// TODO: Do we need to do anything to check for ERROR_IO_PENDING errors?
			/**
			 * Since we are requesting a shared lock, we can obtain it first
			 * even if we already hold the exclusive lock.
			 *
			 * "Shared locks can overlap a locked region provided locks held
			 * on that region are shared locks. A shared lock can overlap an
			 * exclusive lock if both locks were created using the same file handle."
			 * @see https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-lockfileex
			 */
			const lockResult = tryLockFileExSync(
				op.fd,
				flags,
				offsetLow,
				offsetHigh,
				lengthLow,
				lengthHigh
			);
			success = lockResult === 0;

			if (lockResult && preexistingLock?.type === 'exclusive') {
				const exclusiveUnlockResult = tryUnlockFileExSync(
					op.fd,
					offsetLow,
					offsetHigh,
					lengthLow,
					lengthHigh
				);

				if (exclusiveUnlockResult === 0) {
					// This should never happen. Log and throw an error.
					const message =
						'Failed to unlock preexisting exclusive lock after failing to obtain shared lock';
					logger.error(message);
					throw new Error(message);
				}
			}
		} else if (op.type === 'exclusive') {
			flags |= constants.LOCKFILE_EXCLUSIVE_LOCK;

			let sharedUnlockResult;
			if (preexistingLock?.type === 'shared') {
				sharedUnlockResult = tryUnlockFileExSync(
					op.fd,
					offsetLow,
					offsetHigh,
					lengthLow,
					lengthHigh
				);
				// TODO: Log if there's an error
			}

			const lockResult = tryLockFileExSync(
				op.fd,
				flags,
				offsetLow,
				offsetHigh,
				lengthLow,
				lengthHigh
			);
			success = lockResult === 0;
			// TODO: Log if there's an error

			if (lockResult !== 0 && sharedUnlockResult === 0) {
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
				const sharedReLockResult = tryLockFileExSync(
					op.fd,
					// Wait to restore the shared lock.
					0,
					offsetLow,
					offsetHigh,
					lengthLow,
					lengthHigh
				);

				if (sharedReLockResult !== 0) {
					// This should never happen. Log and throw an error.
					const message =
						'Failed to re-lock preexisting shared lock after failing to obtain exclusive lock';
					logger.error(message);
					throw new Error(message);
				}
			}
		} else {
			throw new Error(`Unexpected wholeFileLock() op: '${op.type}'`);
		}

		if (success) {
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

		return success;
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

		// TODO: Make sure zero length ranges are treated as covering the entire remaining range.

		if (!this.rangeLockedFds.has(path)) {
			this.rangeLockedFds.set(path, new FileLockIntervalTree());
		}
		const lockedRangeTree = this.rangeLockedFds.get(path)!;

		// TODO: Add exception handling for Sync calls.
		if (op.type === 'shared' || op.type === 'exclusive') {
			let flags = 0;
			if (op.type === 'exclusive') {
				flags |= constants.LOCKFILE_EXCLUSIVE_LOCK;
			}
			if (!waitForLock) {
				flags |= constants.LOCKFILE_FAIL_IMMEDIATELY;
			}

			// TODO: Implement lock upgrading and downgrading like fcntl() allows.
			// TODO: Implement relocking of preexisting locks like fcntl() allows.
			// TODO: Implement merging locked ranges like fcntl() allows.

			const lockResult = tryLockFileExSync(
				op.fd,
				flags,
				offsetLow,
				offsetHigh,
				lengthLow,
				lengthHigh
			);
			if (!lockResult) {
				return false;
			}

			// TODO: Why is this a type error without `any`? Didn't we pass a shared/exclusive type guard?
			lockedRangeTree.insert(op as any);
			return true;
		} else {
			// TODO: Implement partial unlocking like fcntl() allows.

			const unlockResult = tryUnlockFileExSync(
				op.fd,
				offsetLow,
				offsetHigh,
				lengthLow,
				lengthHigh
			);
			if (!unlockResult) {
				// TODO: Report if the lock does not exist.
				return false;
			}

			// TODO: Report if the lock does not exist.
			lockedRangeTree.remove(op);
			return true;
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

		for (const [path, lockedRangeTree] of this.rangeLockedFds.entries()) {
			const rangesLockedByTargetPid =
				lockedRangeTree.findLocksForProcess(targetPid);
			for (const op of rangesLockedByTargetPid) {
				// TODO: Check for errors and log them.
				// TODO: Consider throwing an error if this fails.
				this.lockFileByteRange(
					path,
					{ ...op, type: 'unlocked' },
					false
				);
				lockedRangeTree.remove(op);
			}
		}
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

		const lockedRangeTree = this.rangeLockedFds.get(targetPath);
		for (const op of lockedRangeTree?.findLocksForProcess(targetPid) ??
			[]) {
			// POSIX fcntl() semantics where a lock is released
			// when any FD associated with the file is closed.
			// TODO: Quote spec and link to it.
			this.lockFileByteRange(
				targetPath,
				{ ...op, type: 'unlocked' },
				false
			);
			lockedRangeTree!.remove(op);
		}
	}
}
