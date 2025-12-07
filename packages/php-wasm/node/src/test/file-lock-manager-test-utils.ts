import { closeSync, openSync } from 'fs';
import {
	type FileLockManager,
	type RequestedRangeLock,
} from '@php-wasm/universal';

// Node.js IPC transfers messages via JSON,
// and the BigInt elements of this API are not supported by JSON.
// So for testing, we define a version of the FileLockManager interface
// that uses numbers instead of BigInts for file content addresses.
// We don't need to use BigInts for testing but the actual FileLockManager interface
// has to use BigInts to handle the 64-bit address space.
export type RequestedRangeLockWithNonBigIntAddresses = Omit<
	RequestedRangeLock,
	'start' | 'end'
> & {
	start: number;
	end: number;
};
export type TestWorkerAPI = Omit<
	FileLockManager,
	'lockFileByteRange' | 'findFirstConflictingByteRangeLock'
> & {
	lockFileByteRange: (
		path: string,
		requestedLock: RequestedRangeLockWithNonBigIntAddresses,
		waitForLock: boolean
	) => boolean;
	findFirstConflictingByteRangeLock: (
		path: string,
		requestedLock: RequestedRangeLockWithNonBigIntAddresses
	) => Omit<RequestedRangeLockWithNonBigIntAddresses, 'fd'> | undefined;
	openSync: typeof openSync;
	closeSync: typeof closeSync;
};

/**
 * Create a remote process API for a file lock manager.
 *
 * @param fileLockManager - The file lock manager to create a remote process API for.
 * @returns An API for the remote test process to expose.
 */
export function createRemoteProcessAPIFromFileLockManager(
	fileLockManager: FileLockManager
): TestWorkerAPI {
	// TODO: Clean up these tests.
	// TODO: Fix this assignment if we proceed with these tests
	// @ts-ignore
	const api: TestWorkerAPI = fileLockManager as TestWorkerAPI;
	const originalLockFileByteRange =
		fileLockManager.lockFileByteRange.bind(fileLockManager);
	api.lockFileByteRange = (
		path,
		requestedLockWithNonBigIntAddresses,
		waitForLock
	) => {
		// Node.js IPC transfers messages via JSON,
		// and the BigInt elements of this API are not supported by JSON.
		// So for testing, we allow numbers to be passed instead,
		// and we convert them to BigInts here.
		const requestedLock = {
			...requestedLockWithNonBigIntAddresses,
			start: BigInt(requestedLockWithNonBigIntAddresses.start),
			end: BigInt(requestedLockWithNonBigIntAddresses.end),
		};

		return originalLockFileByteRange(path, requestedLock, waitForLock);
	};
	const originalFindFirstConflictingByteRangeLock =
		fileLockManager.findFirstConflictingByteRangeLock.bind(fileLockManager);
	api.findFirstConflictingByteRangeLock = (
		path,
		requestedLockWithNonBigIntAddresses
	): Omit<RequestedRangeLockWithNonBigIntAddresses, 'fd'> | undefined => {
		// Node.js IPC transfers messages via JSON,
		// and the BigInt elements of this API are not supported by JSON.
		// So for testing, we allow numbers to be passed instead,
		// and we convert them to BigInts here.
		const requestedLock: RequestedRangeLock = {
			...requestedLockWithNonBigIntAddresses,
			start: BigInt(requestedLockWithNonBigIntAddresses.start),
			end: BigInt(requestedLockWithNonBigIntAddresses.end),
		};
		const result = originalFindFirstConflictingByteRangeLock(
			path,
			requestedLock
		);
		if (result === undefined) {
			return undefined;
		}
		return {
			...result,
			start: Number(result.start as bigint),
			end: Number(result.end as bigint),
		};
	};
	// TODO: Make this less strange
	// IPC with child processes uses JSON, and the URL type is not supported by JSON.
	// So, if the input is a string that looks like a file URL, we convert it to a URL.
	api.openSync = ((name: string | URL, ...rest) => {
		if (typeof name === 'string' && name.startsWith('file://')) {
			name = new URL(name);
		}
		return openSync(name, ...rest);
	}) as typeof openSync;
	api.closeSync = closeSync;
	return api;
}
