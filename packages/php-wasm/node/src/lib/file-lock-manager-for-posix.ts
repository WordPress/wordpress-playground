import type {
	FileLockManager,
	WholeFileLockOp,
	RequestedRangeLock,
} from '@php-wasm/universal';
// TODO: Add these types to the fs-ext-extra-prebuilt package.
import { fcntlSync, flockSync } from 'fs-ext-extra-prebuilt';

export class FileLockManagerForWindows implements FileLockManager {
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
			return true;
		} catch {
			// TODO: Catch and report errors unrelated to flock() denials.
			return false;
		}
	}

	lockFileByteRange(
		path: string,
		op: RequestedRangeLock,
		waitForLock: boolean
	): boolean {
		const fcntlCmd = waitForLock ? 'setlkw' : 'setlk';
		try {
			fcntlSync(op.fd, fcntlCmd);
			return true;
		} catch {
			// TODO: Catch and report errors unrelated to fcntl() denials.
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

		// With fs-ext's current fcntl() implementation,
		// we cannot query existing locks properly with F_GETLK.
		// It only returns whether the F_GETLK command failed or not,
		// and AFAIK, an F_GETLK can succeed whether there is a conflicting lock or not.
		// We can fix this in our fs-ext fork,
		// but for now, let just try to lock the requested range.
		const obtainedLock = this.lockFileByteRange(path, op, false);
		if (!obtainedLock) {
			return undefined;
		}

		// There is a conflicting lock. Since we query what lock conflicts
		// until our fs-ext fork fixes that, let's report that the entire range is locked.
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
