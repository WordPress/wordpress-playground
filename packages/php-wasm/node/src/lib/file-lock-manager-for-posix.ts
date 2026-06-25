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
	FileLockIntervalTree,
	MAX_ADDRESSABLE_FILE_OFFSET,
} from '@php-wasm/universal';
import { constants, fcntlSync, flockSync } from 'fs-ext-extra-prebuilt';
import { logger } from '@php-wasm/logger';

/**
 * Check whether an error is a lock denial (EWOULDBLOCK, EAGAIN, or EACCES)
 * as opposed to an unexpected system error.
 */
function isLockDenialError(e: unknown): boolean {
	if (e && typeof e === 'object' && 'code' in e) {
		const code = (e as { code: string }).code;
		return code === 'EWOULDBLOCK' || code === 'EAGAIN' || code === 'EACCES';
	}
	return false;
}

type StoredWholeFileLock = WholeFileLockOp & { path: Path };

export class FileLockManagerForPosix implements FileLockManager {
	wholeFileLockMap = new Map<Pid, Map<Fd, StoredWholeFileLock>>();
	rangeLocksByPath = new Map<Path, FileLockIntervalTree>();

	lockWholeFile(path: string, op: WholeFileLockOp): boolean {
		const opType =
			op.type === 'unlock'
				? 'un'
				: op.waitForLock
					? op.type === 'exclusive'
						? 'ex'
						: 'sh'
					: op.type === 'exclusive'
						? 'exnb'
						: 'shnb';

		try {
			flockSync(op.fd, opType);

			// Remember lock so we can release them
			// when the process exits or the file descriptor is closed.
			if (op.type === 'unlock') {
				this.wholeFileLockMap.get(op.pid)?.delete(op.fd);
			} else {
				if (!this.wholeFileLockMap.has(op.pid)) {
					this.wholeFileLockMap.set(op.pid, new Map());
				}
				this.wholeFileLockMap.get(op.pid)!.set(op.fd, {
					...op,
					path,
				});
			}

			return true;
		} catch (e) {
			if (!isLockDenialError(e)) {
				logger.warn('flock(): unexpected error', e);
			}
			return false;
		}
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

		const fcntlCmd = waitForLock ? 'setlkw' : 'setlk';
		const fcntlOp =
			op.type === 'unlocked'
				? constants.F_UNLCK
				: op.type === 'exclusive'
					? constants.F_WRLCK
					: constants.F_RDLCK;

		try {
			// TODO: Fix this API to take bigint for start and end. Possible optionally.
			fcntlSync(
				op.fd,
				fcntlCmd,
				fcntlOp,
				Number(op.start),
				Number(op.end - op.start)
			);

			this.recordRangeLockOp(path, op);

			return true;
		} catch (e) {
			if (!isLockDenialError(e)) {
				logger.warn('fcntl(): unexpected error', e);
			}
			return false;
		}
	}

	findFirstConflictingByteRangeLock(
		path: string,
		op: RequestedRangeLock
	): ReturnType<FileLockManager['findFirstConflictingByteRangeLock']> {
		if (op.type === 'unlocked') {
			return undefined;
		}

		// TODO: Is this still true with our fork?
		// With fs-ext's current fcntl() implementation,
		// we cannot query existing locks properly with F_GETLK.
		// It only returns whether the F_GETLK command failed or not,
		// and AFAIK, an F_GETLK can succeed whether there is a conflicting lock or not.
		// We can fix this in our fs-ext fork,
		// but for now, let just try to lock the requested range.
		const obtainedLock = this.lockFileByteRange(path, op, false);
		if (obtainedLock) {
			this.lockFileByteRange(path, { ...op, type: 'unlocked' }, true);
			return undefined;
		}

		// Since we cannot obtain a lock, assume there is a conflicting lock.
		// Since we query what lock conflicts
		// until our fs-ext fork fixes that, let's report that the entire range is locked.
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

		for (const [path, rangeLocks] of this.rangeLocksByPath) {
			const locksForProcess = rangeLocks.findLocksForProcess(targetPid);
			if (locksForProcess.length === 0) {
				continue;
			}

			/*
			 * fcntl() lets us request to unlock the entire byte range for this process,
			 * so we do that instead of tracking and unlocking specific ranges.
			 * NOTE: Actually, the native OS is not aware of the php-wasm process ID,
			 * but since we track live locks associated with each process and path,
			 * we can unlock using any FD that currently represents one of those locks.
			 */
			const fd = locksForProcess[0].fd;
			try {
				this.lockFileByteRange(
					path,
					{
						pid: targetPid,
						fd,
						type: 'unlocked',
						start: 0n,
						end: MAX_ADDRESSABLE_FILE_OFFSET,
					},
					false
				);
			} catch (e) {
				logger.error(
					`releaseLocksForProcess: failed to unlock byte range for pid=${targetPid} fd=${fd} path=${path}`,
					e
				);
			}
		}
	}

	releaseLocksOnFdClose(
		targetPid: number,
		targetFd: number,
		targetPath: string
	): void {
		// Do nothing because the native OS is responsible for releasing
		// whole-file locks when the FD is closed.

		this.wholeFileLockMap.get(targetPid)?.delete(targetFd);

		// fcntl()-based locks are released whenever any file descriptor for the
		// target file is closed, regardless of which FD was used to obtain the lock.
		this.recordRangeLockOp(targetPath, {
			pid: targetPid,
			fd: targetFd,
			type: 'unlocked',
			start: 0n,
			end: MAX_ADDRESSABLE_FILE_OFFSET,
		});
	}

	private normalizeRangeLockOp(op: RequestedRangeLock): RequestedRangeLock {
		if (op.start !== op.end) {
			return op;
		}

		return {
			...op,
			end: MAX_ADDRESSABLE_FILE_OFFSET,
		};
	}

	private recordRangeLockOp(path: Path, op: RequestedRangeLock): void {
		op = this.normalizeRangeLockOp(op);

		let rangeLocks = this.rangeLocksByPath.get(path);
		if (!rangeLocks) {
			if (op.type === 'unlocked') {
				return;
			}

			rangeLocks = new FileLockIntervalTree();
			this.rangeLocksByPath.set(path, rangeLocks);
		}

		if (op.type === 'unlocked') {
			const overlappingLocksForProcess = rangeLocks
				.findOverlapping(op)
				.filter((lock) => lock.pid === op.pid);

			for (const overlappingLock of overlappingLocksForProcess) {
				rangeLocks.remove(overlappingLock);

				if (overlappingLock.start < op.start) {
					rangeLocks.insert({
						...overlappingLock,
						end: op.start,
					});
				}

				if (overlappingLock.end > op.end) {
					rangeLocks.insert({
						...overlappingLock,
						start: op.end,
					});
				}
			}

			this.forgetPathIfNoRangeLocks(path);
			return;
		}

		const overlappingLocksForProcess = rangeLocks
			.findOverlapping(op)
			.filter((lock) => lock.pid === op.pid);

		let minStart = op.start;
		let maxEnd = op.end;
		for (const overlappingLock of overlappingLocksForProcess) {
			rangeLocks.remove(overlappingLock);

			if (overlappingLock.start < minStart) {
				minStart = overlappingLock.start;
			}
			if (overlappingLock.end > maxEnd) {
				maxEnd = overlappingLock.end;
			}
		}

		rangeLocks.insert({
			...(op as LockedRange),
			start: minStart,
			end: maxEnd,
		});
	}

	private forgetPathIfNoRangeLocks(path: Path): void {
		if (this.rangeLocksByPath.get(path)?.isEmpty()) {
			this.rangeLocksByPath.delete(path);
		}
	}
}
