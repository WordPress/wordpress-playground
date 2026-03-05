import type { FileLockManager } from '@php-wasm/universal';

/**
 * Shared state that persists across all PHP-WASM processes, analogous
 * to OS kernel space. Currently holds the file lock manager that
 * coordinates locks across PHP-WASM instances.
 */
export type WasmKernelSpace = {
	readonly fileLockManager: FileLockManager | undefined;
};
