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
 * Unlike PHPProcessManager, this does not maintain a pool of instances
 * or implement concurrency control. It simply returns the same PHP
 * instance for every request.
 *
 * This is suitable for CLI contexts where:
 * - Only one PHP instance is needed
 * - Runtime rotation is handled separately via php.enableRuntimeRotation()
 * - Concurrency is not a concern (each worker has its own instance)
 */
export class SinglePHPInstanceManager implements PHPInstanceManager {
	private php: PHP | undefined;
	private phpPromise: Promise<PHP> | undefined;
	private phpFactory?: () => Promise<PHP>;

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

	async acquirePHPInstance(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_options: { considerPrimary?: boolean } = {}
	): Promise<AcquiredPHP> {
		const php = await this.getPrimaryPhp();

		return {
			php,
			reap: () => {
				// For single-instance manager, reap is a no-op.
				// The instance is reused for all requests.
			},
		};
	}

	async [Symbol.asyncDispose](): Promise<void> {
		if (this.php) {
			this.php.exit();
		}
	}
}
