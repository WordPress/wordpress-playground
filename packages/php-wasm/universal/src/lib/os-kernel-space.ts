// TODO: Consider merging FileLockManager file with os-kernel-space.
import type { Promised } from '@php-wasm/util';
import type { FileLockManager } from './file-lock-manager';
import type { RemoteAPI } from './api';

// TODO: Consider merging FileLockManager into this type.
export class OSKernelSpace {
	readonly fileLockManager:
		| RemoteAPI<FileLockManager>
		// Allow promised type for testing without providing true RemoteAPI.
		| Promised<FileLockManager>
		| FileLockManager
		| undefined;

	constructor(fileLockManager: FileLockManager) {
		this.fileLockManager = fileLockManager;
	}
}
