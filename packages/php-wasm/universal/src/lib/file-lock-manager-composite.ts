import {
	type Path,
	type RequestedRangeLock,
	type WholeFileLockOp,
	type FileLockManager,
} from './file-lock-manager';
import { logger } from '@php-wasm/logger';

// TODO: Add optional granular tracing
export class FileLockManagerComposite implements FileLockManager {
	nativeLockManager: FileLockManager;
	wasmLockManager: FileLockManager;

	constructor({
		nativeLockManager,
		wasmLockManager,
	}: {
		nativeLockManager: FileLockManager;
		wasmLockManager: FileLockManager;
	}) {
		this.nativeLockManager = nativeLockManager;
		this.wasmLockManager = wasmLockManager;
	}

	lockWholeFile(path: Path, op: WholeFileLockOp): boolean {
		if (op.type !== 'unlock') {
			/**
			 * We lock starting with the outside and moving to the inside.
			 * - OS locking comes first as the highest authority.
			 * - WASM locking comes next as our in-house authority.
			 *
			 * This ensures that we only offer locks to WASM instances when
			 * the OS has granted a native lock to our process.
			 */
			let nativeResult;
			let wasmResult;
			try {
				nativeResult = this.nativeLockManager.lockWholeFile(path, op);
				if (!nativeResult) {
					return false;
				}

				wasmResult = this.wasmLockManager.lockWholeFile(path, op);
			} catch (e) {
				logger.error('Unexpected error in lockWholeFile()', e);
			} finally {
				// Rollback the native lock if the wasm lock throws
				// (e.g. comlink-sync timeout). Without this, the native
				// lock would be held indefinitely, blocking all other
				// workers.
				if (nativeResult && !wasmResult) {
					// Rollback the native lock if the wasm lock fails.
					this.nativeLockManager.lockWholeFile(path, {
						...op,
						type: 'unlock',
					});
				}
			}

			return !!nativeResult && !!wasmResult;
		}

		/**
		 * We unlock starting with the inside and moving to the outside.
		 * - WASM locking comes first as our in-house authority.
		 * - OS locking comes last as we return locks to the highest authority.
		 *
		 * This ensures that other OS processes cannot contend with WASM instances
		 * for locks while WASM instances believe they still hold a lock.
		 */
		try {
			this.wasmLockManager.lockWholeFile(path, op);
		} catch (e) {
			logger.error(
				'Unexpected error unlocking whole file with in-memory lock manager',
				e
			);
		}
		try {
			this.nativeLockManager.lockWholeFile(path, op);
		} catch (e) {
			logger.error(
				'Unexpected error unlocking whole file with native lock manager',
				e
			);
		}
		return true;
	}

	lockFileByteRange(
		path: Path,
		requestedLock: RequestedRangeLock,
		waitForLock: boolean
	): boolean {
		if (requestedLock.type !== 'unlocked') {
			/**
			 * We lock starting with the outside and moving to the inside.
			 * - OS locking comes first as the highest authority.
			 * - WASM locking comes next as our in-house authority.
			 *
			 * This ensures that we only offer locks to WASM instances when
			 * the OS has granted a native lock to our process.
			 */
			let nativeResult;
			let wasmResult;
			try {
				nativeResult = this.nativeLockManager.lockFileByteRange(
					path,
					requestedLock,
					waitForLock
				);
				if (!nativeResult) {
					return false;
				}

				wasmResult = this.wasmLockManager.lockFileByteRange(
					path,
					requestedLock,
					waitForLock
				);
			} catch (e) {
				logger.error('Unexpected error in lockFileByteRange()', e);
			} finally {
				if (nativeResult && !wasmResult) {
					// Rollback the native lock if the wasm lock fails.
					this.nativeLockManager.lockFileByteRange(
						path,
						{
							...requestedLock,
							type: 'unlocked',
						},
						false
					);
				}
			}
			return !!nativeResult && !!wasmResult;
		}

		/**
		 * We unlock starting with the inside and moving to the outside.
		 * - WASM locking comes first as our in-house authority.
		 * - OS locking comes last as we return locks to the highest authority.
		 *
		 * This ensures that other OS processes cannot contend with WASM instances
		 * for locks while WASM instances believe they still hold a lock.
		 */
		try {
			this.wasmLockManager.lockFileByteRange(
				path,
				requestedLock,
				waitForLock
			);
		} catch (e) {
			logger.error(
				'Unexpected error unlocking byte range with in-memory lock manager',
				e
			);
		}
		try {
			this.nativeLockManager.lockFileByteRange(
				path,
				requestedLock,
				waitForLock
			);
		} catch (e) {
			logger.error(
				'Unexpected error unlocking byte range with native lock manager',
				e
			);
		}
		return true;
	}

	findFirstConflictingByteRangeLock(
		path: Path,
		desiredLock: RequestedRangeLock
	): Omit<RequestedRangeLock, 'fd'> | undefined {
		try {
			// Check native lock manager first, then wasm lock manager.
			// Return the first conflict found from either.
			const nativeConflict =
				this.nativeLockManager.findFirstConflictingByteRangeLock(
					path,
					desiredLock
				);
			if (nativeConflict) {
				return nativeConflict;
			}

			const wasmConflict =
				this.wasmLockManager.findFirstConflictingByteRangeLock(
					path,
					desiredLock
				);
			return wasmConflict;
		} catch (e) {
			logger.error(
				'Unexpected error in findFirstConflictingByteRangeLock()',
				e
			);
			return undefined;
		}
	}

	releaseLocksForProcess(pid: number): void {
		/**
		 * We unlock starting with the inside and moving to the outside.
		 * - WASM locking comes first as our in-house authority.
		 * - OS locking comes last as we return locks to the highest authority.
		 *
		 * This ensures that other OS processes cannot contend with WASM instances
		 * for locks while WASM instances believe they still hold a lock.
		 */
		try {
			this.wasmLockManager.releaseLocksForProcess(pid);
		} catch (e) {
			logger.error(
				'Unexpected error in wasmLockManager.releaseLocksForProcess()',
				e
			);
		}

		try {
			this.nativeLockManager.releaseLocksForProcess(pid);
		} catch (e) {
			logger.error(
				'Unexpected error in nativeLockManager.releaseLocksForProcess()',
				e
			);
		}
	}

	releaseLocksOnFdClose(pid: number, fd: number, path: Path): void {
		/**
		 * We unlock starting with the inside and moving to the outside.
		 * - WASM locking comes first as our in-house authority.
		 * - OS locking comes last as we return locks to the highest authority.
		 *
		 * This ensures that other OS processes cannot contend with WASM instances
		 * for locks while WASM instances believe they still hold a lock.
		 */
		try {
			this.wasmLockManager.releaseLocksOnFdClose(pid, fd, path);
		} catch (e) {
			logger.error(
				'Unexpected error in wasmLockManager.releaseLocksOnFdClose()',
				e
			);
		}

		try {
			this.nativeLockManager.releaseLocksOnFdClose(pid, fd, path);
		} catch (e) {
			logger.error(
				'Unexpected error in nativeLockManager.releaseLocksOnFdClose()',
				e
			);
		}
	}
}
