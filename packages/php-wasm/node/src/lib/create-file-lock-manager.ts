import {
	FileLockManagerComposite,
	FileLockManagerInMemory,
	type FileLockManager,
} from '@php-wasm/universal';
import { logger } from '@php-wasm/logger';
import { platform } from 'node:os';
import { FileLockManagerForPosix } from './file-lock-manager-for-posix';
import { FileLockManagerForWindows } from './file-lock-manager-for-windows';

// Runtimes in the same JS thread must share locks even without a caller-supplied
// manager. CLI workers instead receive a proxy to their parent's shared manager.
const localLocks = new FileLockManagerInMemory();
let warnedAboutNativeLocks = false;

export function createFileLockManager(
	sharedLocks?: FileLockManager
): FileLockManager {
	try {
		const nativeLocks =
			platform() === 'win32'
				? new FileLockManagerForWindows()
				: new FileLockManagerForPosix();
		return sharedLocks
			? new FileLockManagerComposite({
					nativeLockManager: nativeLocks,
					wasmLockManager: sharedLocks,
				})
			: nativeLocks;
	} catch (error) {
		if (!error || typeof error !== 'object') {
			throw error;
		}
		const { code, message } = error as NodeJS.ErrnoException;
		if (
			code !== 'ERR_DLOPEN_FAILED' &&
			!(
				code === 'MODULE_NOT_FOUND' &&
				message?.includes('fs-ext-extra-prebuilt')
			) &&
			!message?.startsWith('Failed to load fs-ext native module.')
		) {
			throw error;
		}
		if (!warnedAboutNativeLocks) {
			warnedAboutNativeLocks = true;
			logger.warn(
				'Native file locking is unavailable. Using JavaScript locks for participating ' +
					'Playground runtimes only. Do not share their database or writable files ' +
					'with other programs or separate CLI runs.',
				error
			);
		}
	}

	const locks = sharedLocks ?? localLocks;
	const sleep = new Int32Array(new SharedArrayBuffer(4));
	return {
		lockWholeFile(path, op) {
			if (op.type === 'unlock') {
				return locks.lockWholeFile(path, op);
			}
			while (!locks.lockWholeFile(path, { ...op, waitForLock: false })) {
				if (!op.waitForLock) {
					return false;
				}
				// Sleep in the requesting worker, never in the shared lock manager.
				// Its thread must stay free to process another worker's unlock request.
				Atomics.wait(sleep, 0, 0, 10);
			}
			return true;
		},
		lockFileByteRange(path, op, waitForLock) {
			while (!locks.lockFileByteRange(path, op, false)) {
				if (!waitForLock) {
					return false;
				}
				Atomics.wait(sleep, 0, 0, 10);
			}
			return true;
		},
		findFirstConflictingByteRangeLock: (path, op) =>
			locks.findFirstConflictingByteRangeLock(path, op),
		releaseLocksOnFdClose: (pid, fd, path) =>
			locks.releaseLocksOnFdClose(pid, fd, path),
		releaseLocksForProcess: (pid) => locks.releaseLocksForProcess(pid),
	};
}
