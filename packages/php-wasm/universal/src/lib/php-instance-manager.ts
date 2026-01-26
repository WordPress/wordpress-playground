import type { PHP } from './php';

/**
 * Result of acquiring a PHP instance.
 * The `reap` function should be called when done with the instance.
 */
export interface AcquiredPHP {
	php: PHP;
	/**
	 * Release the PHP instance back to the pool (for multi-instance managers)
	 * or mark it as idle (for single-instance managers).
	 */
	reap: () => void;
}

/**
 * Minimal interface for managing PHP instances.
 *
 * This interface allows PHPRequestHandler to work with different
 * instance management strategies:
 * - PHPProcessManager: Multiple PHP instances with concurrency control
 * - SinglePHPInstanceManager: Single PHP instance for CLI contexts
 */
export interface PHPInstanceManager extends AsyncDisposable {
	/**
	 * Get the primary PHP instance.
	 * This instance is persistent and never killed.
	 */
	getPrimaryPhp(): Promise<PHP>;

	/**
	 * Acquire a PHP instance for processing a request.
	 *
	 * @returns An acquired PHP instance with a reap function.
	 */
	acquirePHPInstance(): Promise<AcquiredPHP>;
}
