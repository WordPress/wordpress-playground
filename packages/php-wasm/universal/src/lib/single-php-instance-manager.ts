import { Semaphore } from '@php-wasm/util';
import type { PHP } from './php';
import type { PHPInstanceManager, AcquiredPHP } from './php-instance-manager';

export interface SinglePHPInstanceManagerOptions {
	/**
	 * Either provide an existing PHP instance...
	 */
	php?: PHP;
	/**
	 * ...or a factory to create one on demand.
	 */
	phpFactory?: () => Promise<PHP>;
}

/**
 * A minimal PHP instance manager that manages a single PHP instance.
 *
 * Unlike PHPProcessManager, this does not maintain a pool of instances.
 * It returns the same PHP instance for every request, and serializes
 * concurrent acquires through a 1-concurrency semaphore so the
 * single instance handles requests one at a time.
 *
 * This is suitable for:
 * - CLI contexts where only one PHP instance is needed
 * - Legacy PHP runtimes (e.g. 5.6) whose multi-instance support is
 *   unreliable and which must handle parallel requests on a single
 *   instance
 * - Runtime rotation is handled separately via `php.enableRuntimeRotation()`
 */
export class SinglePHPInstanceManager implements PHPInstanceManager {
	private php: PHP | undefined;
	private phpPromise: Promise<PHP> | undefined;
	private phpFactory?: () => Promise<PHP>;
	private semaphore = new Semaphore({ concurrency: 1 });

	constructor(options: SinglePHPInstanceManagerOptions) {
		if (!options.php && !options.phpFactory) {
			throw new Error(
				'SinglePHPInstanceManager requires either php or phpFactory'
			);
		}
		this.php = options.php;
		this.phpFactory = options.phpFactory;
	}

	async getPrimaryPhp(): Promise<PHP> {
		if (!this.php) {
			if (!this.phpPromise) {
				this.phpPromise = this.phpFactory!().then((php) => {
					this.php = php;
					this.phpPromise = undefined;
					return php;
				});
			}
			return this.phpPromise;
		}
		return this.php;
	}

	async acquirePHPInstance(): Promise<AcquiredPHP> {
		const release = await this.semaphore.acquire();
		const php = await this.getPrimaryPhp();
		return {
			php,
			reap: () => {
				release();
			},
		};
	}

	async [Symbol.asyncDispose](): Promise<void> {
		if (this.php) {
			this.php.exit();
		}
	}
}
