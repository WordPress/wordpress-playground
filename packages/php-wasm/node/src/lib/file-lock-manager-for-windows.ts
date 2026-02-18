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
	LockedRange,
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

function isErrnoError(e: unknown): boolean {
	return (
		e !== null &&
		typeof e === 'object' &&
		('errno' in e || 'code' in e || 'syscall' in e)
	);
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
	} catch (e) {
		if (!isErrnoError(e)) {
			throw e;
		}
		return false;
	}
}

function tryUnlockFileExSync(fd: number, start: bigint, end: bigint): boolean {
	const [offsetLow, offsetHigh] = toLowAndHigh32BitNumbers(start);
	const [lengthLow, lengthHigh] = toLowAndHigh32BitNumbers(end - start);
	try {
		unlockFileExSync(fd, offsetLow, offsetHigh, lengthLow, lengthHigh);
		return true;
	} catch (e) {
		if (!isErrnoError(e)) {
			throw e;
		}
		return false;
	}
}

type StoredWholeFileLock = WholeFileLockOp & { path: Path };

export class FileLockManagerForWindows implements FileLockManager {
	wholeFileLockMap = new Map<Pid, Map<Fd, StoredWholeFileLock>>();
	rangeLockedFds = new Map<Path, FileLockIntervalTree>();

	lockWholeFile(path: string, op: WholeFileLockOp): boolean {
		// For whole-file locks, we address the entire byte range of the file.
		// TODO: Consider converting the exposed Win API to just use bigint for offset and length.
		const start = 0n;
		const end = 2n ** 64n - 1n;

		if (op.type === 'unlock') {
			const success = tryUnlockFileExSync(op.fd, start, end);

			if (success) {
				this.wholeFileLockMap.get(op.pid)?.delete(op.fd);
				if (this.wholeFileLockMap.get(op.pid)?.size === 0) {
					this.wholeFileLockMap.delete(op.pid);
				}
			} else {
				logger.warn(
					`lockWholeFile: unlock failed for pid=${op.pid} fd=${op.fd} path=${path}`
				);
			}

			return success;
		}

		const preexistingLock = this.wholeFileLockMap.get(op.pid)?.get(op.fd);
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

				if (!exclusiveUnlockSuccess) {
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
				if (!sharedUnlockSuccess) {
					logger.warn(
						`lockWholeFile: failed to release shared lock before exclusive upgrade for pid=${op.pid} fd=${op.fd}`
					);
				}
			}

			success = tryLockFileExSync(op.fd, flags, start, end);
			if (!success) {
				logger.debug(
					`lockWholeFile: failed to obtain exclusive lock for pid=${op.pid} fd=${op.fd}`
				);
			}

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
			if (!this.wholeFileLockMap.has(op.pid)) {
				this.wholeFileLockMap.set(op.pid, new Map());
			}
			this.wholeFileLockMap.get(op.pid)!.set(op.fd, {
				...op,
				path,
			});
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

				lockedRangeTree.remove(preexistingLock);
			}

			lockedRangeTree.insert(op as LockedRange);
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
					// The exclusive lock attempt failed, but we already
					// released the shared lock. Re-acquire it to restore
					// the previous state (Windows doesn't support atomic
					// lock upgrades).
					//
					// NOTE: This may be a sort of race condition because another
					// process could have obtained a conflicting lock by the time we
					// try to re-lock. The caller assumes that they never lost a shared
					// lock during their attempt to obtain an exclusive lock,
					// bu the truth is that we temporarily gave up the shared lock.
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

			lockedRangeTree.insert(op as LockedRange);
			return true;
		} else {
			// TODO: Implement partial unlocking like fcntl() allows.

			// Find locks within the requested unlock range. We support
			// ranged unlocks to approximate fcntl() semantics, even
			// though our implementation doesn't yet handle range
			// splitting or merging.
			//
			// Note that we do not filter on the `fd` property in order to respect
			// fcntl() semantics where locks are process-level and not limited to a
			// specific file descriptor.
			const intersectingLocksForThisProcess = overlappingLocks
				.filter((lock) => lock.pid === op.pid)
				.filter((lock) => lock.start >= op.start && lock.end <= op.end);

			for (const lock of intersectingLocksForThisProcess) {
				const success = tryUnlockFileExSync(
					lock.fd,
					lock.start,
					lock.end
				);

				if (!success) {
					logger.warn(
						`lockFileByteRange: unlock failed for pid=${op.pid} fd=${lock.fd} range=[${lock.start},${lock.end}]`
					);
					return false;
				}

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
		const obtainedLock = !!this.lockFileByteRange(path, op, false);

		// Immediately release the test lock
		this.lockFileByteRange(path, { ...op, type: 'unlocked' }, false);

		if (obtainedLock) {
			// No conflicting lock.
			return undefined;
		}

		// There is a conflicting lock. Since we cannot directly query
		// what lock conflicts, report the entire range as locked. This
		// is more honest than echoing back the requested range, which
		// would imply we know the conflict matches the query exactly.
		return {
			type: 'exclusive',
			start: 0n,
			end: 0xffffffff_ffffffffn,
			pid: -1,
		};
	}

	releaseLocksForProcess(targetPid: number): void {
		const fdMap = this.wholeFileLockMap.get(targetPid);
		if (fdMap) {
			for (const storedLock of fdMap.values()) {
				try {
					this.lockWholeFile(storedLock.path, {
						...storedLock,
						type: 'unlock',
					});
				} catch (e) {
					logger.error(
						`releaseLocksForProcess: failed to unlock whole-file lock for pid=${targetPid} fd=${storedLock.fd}`,
						e
					);
				}
			}
			this.wholeFileLockMap.delete(targetPid);
		}

		for (const [path, lockedRangeTree] of this.rangeLockedFds.entries()) {
			const rangesLockedByTargetPid =
				lockedRangeTree.findLocksForProcess(targetPid);
			for (const op of rangesLockedByTargetPid) {
				try {
					this.lockFileByteRange(
						path,
						{ ...op, type: 'unlocked' },
						false
					);
				} catch (e) {
					logger.error(
						`releaseLocksForProcess: failed to unlock byte range for pid=${targetPid} fd=${op.fd} path=${path}`,
						e
					);
				}
				lockedRangeTree.remove(op);
			}
		}
	}

	releaseLocksOnFdClose(
		targetPid: number,
		targetFd: number,
		targetPath: string
	): void {
		const storedLock = this.wholeFileLockMap.get(targetPid)?.get(targetFd);
		if (storedLock) {
			this.lockWholeFile(storedLock.path, {
				...storedLock,
				type: 'unlock',
			});
		}
		this.wholeFileLockMap.get(targetPid)?.delete(targetFd);

		const lockedRangeTree = this.rangeLockedFds.get(targetPath);
		for (const op of lockedRangeTree?.findLocksForProcess(targetPid) ??
			[]) {
			// POSIX fcntl() semantics: closing any FD for a file releases
			// all fcntl() locks on that file for the process.
			// See https://pubs.opengroup.org/onlinepubs/9699919799/functions/fcntl.html
			// "All locks associated with a file for a given process shall
			// be removed when a file descriptor for that file is closed
			// by that process or the process holding that file descriptor
			// terminates."
			this.lockFileByteRange(
				targetPath,
				{
					...op,
					type: 'unlocked',
					// Use a dummy FD because we're releasing locks for
					// all FDs on this file (POSIX semantics), not just
					// the one being closed.
					fd: -1,
				},
				false
			);
			lockedRangeTree!.remove(op);
		}
	}
}
