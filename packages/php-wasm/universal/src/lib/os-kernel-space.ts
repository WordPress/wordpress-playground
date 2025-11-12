// TODO: Consider merging FileLockManager file with os-kernel-space.
import type { FileLockManager } from './file-lock-manager';

// TODO: Consider merging FileLockManager into this type.
export class OSKernelSpace {
	readonly fileLockManager: FileLockManager | undefined;

	constructor(fileLockManager: FileLockManager) {
		this.fileLockManager = fileLockManager;
	}
}
