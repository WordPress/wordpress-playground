import type {
	FileLockManager,
	WholeFileLockOp,
	RequestedRangeLock,
} from '@php-wasm/universal';
// TODO: Add these types to the fs-ext-extra-prebuilt package.
import {
	lockFileExSync,
	unlockFileExSync,
	constants,
} from 'fs-ext-extra-prebuilt';

export class FileLockManagerForWindows implements FileLockManager {
	lockWholeFile(path: string, op: WholeFileLockOp): boolean {
		// For whole-file locks, we address the entire byte range of the file.
		// TODO: Consider converting the exposed Win API to just use bigint for offset and length.
		const offsetLow = 0;
		const offsetHigh = 0;
		const lengthLow = 0xffffffff;
		const lengthHigh = 0xffffffff;

		if (op.type === 'unlock') {
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
			if (!op.waitForLock) {
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

	releaseLocksForProcess(pid: number): void {
		// TODO: Implement tracking of locks held by a process and release them.
	}

	// TODO: Rename this to something clearer like releaseLockOnFileDescriptorClose
	releaseLocksOnFdClose(pid: number, fd: number, path: string): void {
		// TODO: Implement POSIX fcntl() semantics where a lock is released
		// when any FD associated with the file is closed.
	}
}
