import {
	SupportedPHPVersion,
	loadPHPRuntime,
	EmscriptenOptions,
	FileLockManager,
	FileLockState,
} from '@php-wasm/universal';

import { getPHPLoaderModule } from '.';
import { withNetworking } from './networking/with-networking.js';

export interface PHPLoaderOptions {
	emscriptenOptions?: EmscriptenOptions;
}

type ExclusiveLock = {
	type: 'exclusive';
	pid: number;
};
type SharedLock = {
	type: 'shared';
	pids: Set<number>;
};
class FileLockManagerForNode implements FileLockManager {
	locks: Map<string, SharedLock | ExclusiveLock>;

	constructor() {
		this.locks = new Map();
	}

	async lockFile(path: string, type: 'shared' | 'exclusive', pid: number) {
		const existingLock = this.locks.get(path);
		if (existingLock === undefined) {
			this.locks.set(
				path,
				type === 'shared'
					? { type: 'shared', pids: new Set([pid]) }
					: { type: 'exclusive', pid: pid }
			);
			return true;
		}

		if (type === 'shared') {
			if (existingLock.type === 'shared') {
				existingLock.pids.add(pid);
				return true;
			}
			return false;
		}

		if (type === 'exclusive') {
			if (existingLock.type === 'exclusive' && existingLock.pid === pid) {
				return true;
			}
			return false;
		}

		throw new Error(`Failed to handle lockFile(${path}, ${type}) request`);
	}

	async unlockFile(path: string, pid: number) {
		const lock = this.locks.get(path);
		if (!lock) {
			return;
		}

		switch (lock.type) {
			case 'exclusive':
				if (lock.pid === pid) {
					this.locks.delete(path);
				}
				return;
			case 'shared':
				if (lock.pids.has(pid)) {
					lock.pids.delete(pid);
					if (lock.pids.size === 0) {
						this.locks.delete(path);
					}
				}
				return;
			default:
				throw new Error(`Unknown file lock type: '${lock.type}'`);
		}
	}

	async getConflictingLock(
		path: string,
		desiredLockState: FileLockState,
		pid: number
	): Promise<FileLockState> {
		const existingLock = this.locks.get(path);
		if (!existingLock) {
			return 'unlocked';
		}

		const lockIsSolelyOwnedByThisPid =
			(existingLock.type === 'exclusive' && existingLock.pid === pid) ||
			(existingLock.type === 'shared' &&
				existingLock.pids.size === 1 &&
				existingLock.pids.has(pid));
		if (lockIsSolelyOwnedByThisPid) {
			return 'unlocked';
		}

		if (desiredLockState === 'shared' && existingLock.type === 'shared') {
			// Shared locks do not conflict with each other
			return 'unlocked';
		} else {
			// Exclusive locks conflict with both shared and exclusive locks
			return existingLock.type;
		}
	}
}

/**
 * Does what load() does, but synchronously returns
 * an object with the PHP instance and a promise that
 * resolves when the PHP instance is ready.
 *
 * @see load
 */
export async function loadNodeRuntime(
	phpVersion: SupportedPHPVersion,
	options: PHPLoaderOptions = {}
) {
	const emscriptenOptions: EmscriptenOptions = {
		/**
		 * Emscripten default behavior is to kill the process when
		 * the WASM program calls `exit()`. We want to throw an
		 * exception instead.
		 */
		quit: function (code, error) {
			throw error;
		},
		...(options.emscriptenOptions || {}),

		fileLockManager: new FileLockManagerForNode(),
	};
	return await loadPHPRuntime(
		await getPHPLoaderModule(phpVersion),
		await withNetworking(emscriptenOptions)
	);
}
