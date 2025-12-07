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
import {
	MAX_ADDRESSABLE_FILE_OFFSET,
	FileLockIntervalTree,
} from '@php-wasm/universal';

function toLowAndHigh32BitNumbers(num: bigint): [number, number] {
	const low = Number(num & 0xffffffffn);
	const high = Number((num >> 32n) & 0xffffffffn);
	return [low, high];
}

function tryLockFileExSync(
	fd: number,
	flags: number,
	start: bigint,
	end: bigint
): boolean {
	const [offsetLow, offsetHigh] = toLowAndHigh32BitNumbers(start);
	const [lengthLow, lengthHigh] = toLowAndHigh32BitNumbers(end - start);
	try {
		lockFileExSync(fd, flags, offsetLow, offsetHigh, lengthLow, lengthHigh);
		return true;
	} catch {
		// TODO: Rethrow if not an errno error
		return false;
	}
}

function tryUnlockFileExSync(fd: number, start: bigint, end: bigint): boolean {
	const [offsetLow, offsetHigh] = toLowAndHigh32BitNumbers(start);
	const [lengthLow, lengthHigh] = toLowAndHigh32BitNumbers(end - start);
	try {
		unlockFileExSync(fd, offsetLow, offsetHigh, lengthLow, lengthHigh);
		return true;
	} catch {
		// TODO: Rethrow if not an errno error
		return false;
	}
}

export class FileLockManagerForWindows implements FileLockManager {
	// TODO: Move path of whole file lock into leaf. It is never used for lookup.
	wholeFileLockMap = new Map<Path, Map<Pid, Map<Fd, WholeFileLockOp>>>();
	rangeLockedFds = new Map<Path, FileLockIntervalTree>();

	lockWholeFile(path: string, op: WholeFileLockOp): boolean {
		// For whole-file locks, we address the entire byte range of the file.
		// TODO: Consider converting the exposed Win API to just use bigint for offset and length.
		const start = 0n;
		const end = 2n ** 64n - 1n;

		if (op.type === 'unlock') {
			// TODO: Should we skip unlocking if we do not have record of the lock?

			// TODO: Catch errors
			const success = tryUnlockFileExSync(op.fd, start, end);

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

		let success = false;
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
			success = tryLockFileExSync(op.fd, flags, start, end);

			if (success && preexistingLock?.type === 'exclusive') {
				const exclusiveUnlockSuccess = tryUnlockFileExSync(
					op.fd,
					start,
					end
				);

				if (exclusiveUnlockSuccess) {
					// This should never happen. Log and throw an error.
					const message =
						'Failed to unlock preexisting exclusive lock after failing to obtain shared lock';
					logger.error(message);
					throw new Error(message);
				}
			}
		} else if (op.type === 'exclusive') {
			flags |= constants.LOCKFILE_EXCLUSIVE_LOCK;

			let sharedUnlockSuccess;
			if (preexistingLock?.type === 'shared') {
				sharedUnlockSuccess = tryUnlockFileExSync(op.fd, start, end);
				// TODO: Log if there's an error
			}

			success = tryLockFileExSync(op.fd, flags, start, end);
			// TODO: Log if there's an error

			if (!success && sharedUnlockSuccess) {
				/*
				 * We failed to obtain the exclusive lock but already
				 * dropped the shared lock because preexisting shared locks
				 * will block the exclusive lock.
				 *
				 * "If an exclusive lock is requested for a range of a file that
				 * already has a shared or exclusive lock, the function returns
				 * the error ERROR_IO_PENDING."
				 * @see https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-lockfileex
				 *
				 * NOTE: This actually introduces a condition where the caller of fcntl()
				 * does not realize it temporarily lost a shared lock. It is possible
				 * another party could have obtained an exclusive lock and written
				 * to the file by the time we are able to obtain the shared lock.
				 */
				const sharedReLockResult = tryLockFileExSync(
					op.fd,
					// Wait to restore the shared lock.
					0,
					start,
					end
				);

				if (!sharedReLockResult) {
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
		if (op.start === op.end) {
			/*
			 * Treat a range with zero length as covering the entire remaining range.
			 * POSIX Ref: https://pubs.opengroup.org/onlinepubs/9799919799/functions/fcntl.html
			 *   "A lock shall be set to extend to the largest possible value of the file offset
			 *    for that file by setting l_len to 0."
			 */
			op = {
				...op,
				end: MAX_ADDRESSABLE_FILE_OFFSET,
			};
		}

		if (!this.rangeLockedFds.has(path)) {
			this.rangeLockedFds.set(path, new FileLockIntervalTree());
		}
		const lockedRangeTree = this.rangeLockedFds.get(path)!;

		const overlappingLocks = lockedRangeTree.findOverlapping(op);
		let preexistingLock;
		if (
			overlappingLocks.length === 1 &&
			overlappingLocks[0].pid === op.pid &&
			// NOTE: FD shouldn't matter for fcntl() F_SETLK because it is a process-level lock,
			// but it matters for Windows where locks are fd-specific.
			overlappingLocks[0].fd === op.fd &&
			overlappingLocks[0].start === op.start &&
			overlappingLocks[0].end === op.end
		) {
			preexistingLock = overlappingLocks[0];
		}

		if (op.type === preexistingLock?.type) {
			// There is nothing to do.
			return true;
		}

		// TODO: Implement lock upgrading and downgrading like fcntl() allows?
		// TODO: Implement relocking of preexisting locks like fcntl() allows?
		// TODO: Implement merging locked ranges like fcntl() allows?

		let flags = 0;
		if (!waitForLock) {
			flags |= constants.LOCKFILE_FAIL_IMMEDIATELY;
		}
		// TODO: Add exception handling for Sync calls.
		if (op.type === 'shared') {
			const success = tryLockFileExSync(op.fd, flags, op.start, op.end);
			if (!success) {
				return false;
			}

			if (preexistingLock?.type === 'exclusive') {
				const releasedPreexistingExclusiveLock = tryUnlockFileExSync(
					preexistingLock.fd,
					preexistingLock.start,
					preexistingLock.end
				);
				if (!releasedPreexistingExclusiveLock) {
					// This should never happen. Log and throw an error.
					const message =
						'Failed to unlock preexisting exclusive lock after obtaining a shared lock';
					logger.error(message);
					throw new Error(message);
				}
			}

			// TODO: Why is this a type error without `any`? Didn't we pass a shared/exclusive type guard?
			lockedRangeTree.insert(op as any);
			return true;
		} else if (op.type === 'exclusive') {
			let sharedUnlockSuccess;
			if (preexistingLock?.type === 'shared') {
				sharedUnlockSuccess = tryUnlockFileExSync(
					op.fd,
					op.start,
					op.end
				);
			}

			if (op.type === 'exclusive') {
				flags |= constants.LOCKFILE_EXCLUSIVE_LOCK;
			}

			const success = tryLockFileExSync(op.fd, flags, op.start, op.end);
			if (!success) {
				if (preexistingLock && sharedUnlockSuccess) {
					// TODO: Explain what and why
					const sharedRelockSuccess = tryLockFileExSync(
						op.fd,
						0,
						op.start,
						op.end
					);
					if (!sharedRelockSuccess) {
						// This should never happen. Log and throw an error.
						const message =
							'Failed to re-lock preexisting shared lock after failing to obtain exclusive lock';
						logger.error(message);
						throw new Error(message);
					}
				}
				return false;
			}

			// TODO: Why is this a type error without `any`? Didn't we pass a shared/exclusive type guard?
			lockedRangeTree.insert(op as any);
			return true;
		} else {
			// TODO: Implement partial unlocking like fcntl() allows.

			// TODO: Implement range unlocks

			// TODO: Say why supporting ranged unlocks
			const intersectingLocksForThisProcess = overlappingLocks
				.filter((lock) => lock.pid === op.pid)
				// TODO: Say why we are treating ranged locks as fd-specific
				.filter((lock) => lock.fd === op.fd)
				.filter((lock) => lock.start >= op.start && lock.end <= op.end);

			for (const lock of intersectingLocksForThisProcess) {
				const success = tryUnlockFileExSync(
					lock.fd,
					lock.start,
					lock.end
				);

				if (!success) {
					// TODO: Why if partial unlock before failure. Should we throw?
					// TODO: Report if the lock does not exist.
					return false;
				}

				// TODO: Report if the lock does not exist.
				lockedRangeTree.remove(lock);
			}
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
		if (obtainedLock) {
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
		const wholeFileLockOp = this.wholeFileLockMap
			.get(targetPath)
			?.get(targetPid)
			?.get(targetFd);
		if (wholeFileLockOp) {
			this.lockWholeFile(targetPath, {
				...wholeFileLockOp,
				type: 'unlock',
			});
		}
		this.wholeFileLockMap.get(targetPath)?.get(targetPid)?.delete(targetFd);

		const lockedRangeTree = this.rangeLockedFds.get(targetPath);
		for (const op of lockedRangeTree?.findLocksForProcess(targetPid) ??
			[]) {
			// POSIX fcntl() semantics where a lock is released
			// when any FD associated with the file is closed.
			// TODO: Quote spec and link to it.
			this.lockFileByteRange(
				targetPath,
				{
					...op,
					type: 'unlocked',
					// TODO: Say why using dummy FD
					fd: -1,
				},
				false
			);
			lockedRangeTree!.remove(op);
		}
	}
}
