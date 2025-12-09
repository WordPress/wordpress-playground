import type {
	FileLockManager,
	WholeFileLockOp,
	RequestedRangeLock,
	Pid,
	Fd,
} from '@php-wasm/universal';
// TODO: Add these types to the fs-ext-extra-prebuilt package.
import { fcntlSync, flockSync } from 'fs-ext-extra-prebuilt';

export class FileLockManagerForPosix implements FileLockManager {
	wholeFileLockMap = new Map<string, Map<Pid, Map<Fd, WholeFileLockOp>>>();

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
				this.wholeFileLockMap.get(path)?.get(op.pid)?.delete(op.fd);
			} else {
				if (!this.wholeFileLockMap.has(path)) {
					this.wholeFileLockMap.set(path, new Map());
				}
				if (!this.wholeFileLockMap.get(path)!.has(op.pid)) {
					this.wholeFileLockMap.get(path)!.set(op.pid, new Map());
				}
				this.wholeFileLockMap.get(path)!.get(op.pid)!.set(op.fd, op);
			}

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

	releaseLocksForProcess(targetPid: number): void {
		for (const [path, pidMap] of this.wholeFileLockMap.entries()) {
			const fdMap = pidMap.get(targetPid);
			if (!fdMap) {
				continue;
			}

			for (const op of fdMap.values()) {
				this.lockWholeFile(path, { ...op, type: 'unlock' });
			}

			pidMap.delete(targetPid);
		}

		// TODO: Implement tracking of range locks held by a process and release them.
	}

	// TODO: Rename this to something clearer like releaseLockOnFileDescriptorClose
	releaseLocksOnFdClose(
		targetPid: number,
		targetFd: number,
		targetPath: string
	): void {
		const wholeFilePidMap = this.wholeFileLockMap.get(targetPath);
		const wholeFilePidFdMap = wholeFilePidMap?.get(targetPid);
		const wholeFileLock = wholeFilePidFdMap?.get(targetFd);

		if (wholeFileLock) {
			this.lockWholeFile(targetPath, {
				...wholeFileLock,
				type: 'unlock',
			});

			wholeFilePidFdMap?.delete(targetFd);
			if (wholeFilePidFdMap?.size === 0) {
				wholeFilePidMap?.delete(targetPid);
			}
			if (wholeFilePidMap?.size === 0) {
				this.wholeFileLockMap.delete(targetPath);
			}
		}

		// TODO: Implement POSIX fcntl() semantics where a lock is released
		// when any FD associated with the file is closed.
	}
}
