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
	const api: TestWorkerAPI = {
		lockWholeFile: fileLockManager.lockWholeFile.bind(fileLockManager),
		releaseLocksForProcess:
			fileLockManager.releaseLocksForProcess.bind(fileLockManager),
		releaseLocksOnFdClose:
			fileLockManager.releaseLocksOnFdClose.bind(fileLockManager),

		// Node.js IPC transfers messages via JSON, and BigInt is
		// not supported by JSON. So for testing, the API accepts
		// numbers and converts them to BigInts before delegating.
		lockFileByteRange: (path, req, waitForLock) => {
			return fileLockManager.lockFileByteRange(
				path,
				{ ...req, start: BigInt(req.start), end: BigInt(req.end) },
				waitForLock
			);
		},
		findFirstConflictingByteRangeLock: (path, req) => {
			const result = fileLockManager.findFirstConflictingByteRangeLock(
				path,
				{
					...req,
					start: BigInt(req.start),
					end: BigInt(req.end),
				}
			);
			if (result === undefined) {
				return undefined;
			}
			return {
				...result,
				start: Number(result.start as bigint),
				end: Number(result.end as bigint),
			};
		},

		// IPC with child processes uses JSON, and the URL type
		// is not supported by JSON. Convert file:// strings to URLs.
		openSync: ((name: string | URL, flags: number, mode?: number) => {
			if (typeof name === 'string' && name.startsWith('file://')) {
				name = new URL(name);
			}
			return openSync(name, flags, mode);
		}) as typeof openSync,
		closeSync,
	};
	return api;
}
