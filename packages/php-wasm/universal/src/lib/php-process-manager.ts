import { AcquireTimeoutError, Semaphore } from '@php-wasm/util';
import { BasePHP } from './base-php';

export type PHPFactoryOptions = {
	isPrimary: boolean;
};

export type PHPFactory<PHP extends BasePHP> = (
	options: PHPFactoryOptions
) => Promise<PHP>;

export interface ProcessManagerOptions<PHP extends BasePHP> {
	/**
	 * The maximum number of PHP instances that can exist at
	 * the same time.
	 */
	maxPhpInstances?: number;
	/**
	 * The number of milliseconds to wait for a PHP instance when
	 * we have reached the maximum number of PHP instances and
	 * cannot spawn a new one. If the timeout is reached, we assume
	 * all the PHP instances are deadlocked and a throw MaxPhpInstancesError.
	 *
	 * Default: 5000
	 */
	timeout?: number;
	/**
	 * The primary PHP instance that's never killed. This instance
	 * contains the reference filesystem used by all other PHP instances.
	 */
	primaryPhp?: PHP;
	/**
	 * A factory function used for spawning new PHP instances.
	 */
	phpFactory?: PHPFactory<PHP>;
}

export interface SpawnedPHP<PHP extends BasePHP> {
	php: PHP;
	reap: () => void;
}

export class MaxPhpInstancesError extends Error {
	constructor(limit: number) {
		super(
			`Requested more concurrent PHP instances than the limit (${limit}).`
		);
		this.name = this.constructor.name;
	}
}

/**
 * A PHP Process manager.
 *
 * Maintains:
 * * A single "primary" PHP instance that's never killed – it contains the
 *   reference filesystem used by all other PHP instances.
 * * A pool of disposable PHP instances that are spawned to handle a single
 *   request and reaped immediately after.
 *
 * When a new request comes in, PHPProcessManager yields the idle instance to handle it,
 * and immediately starts initializing a new idle instance. In other words, for n concurrent
 * requests, there are at most n+1 PHP instances running at the same time.
 *
 * A slight nuance is that the first idle instance is not initialized until the first
 * concurrent request comes in. This is because many use-cases won't involve parallel
 * requests and, for those, we can avoid eagerly spinning up a second PHP instance.
 *
 * This strategy is inspired by Cowboy, an Erlang HTTP server. Handling a single extra
 * request can happen immediately, while handling multiple extra requests requires
 * extra time to spin up a few PHP instances. This is a more resource-friendly tradeoff
 * than keeping 5 idle instances at all times.
 */
export class PHPProcessManager<PHP extends BasePHP> implements AsyncDisposable {
	private primaryPhp?: PHP;
	private primaryIdle = true;
	private nextInstance: Promise<SpawnedPHP<PHP>> | null = null;
	/**
	 * All spawned PHP instances, including the primary PHP instance.
	 * Used for bookkeeping and reaping all instances on dispose.
	 */
	private allInstances: Promise<SpawnedPHP<PHP>>[] = [];
	private phpFactory?: PHPFactory<PHP>;
	private maxPhpInstances: number;
	private semaphore: Semaphore;

	constructor(options?: ProcessManagerOptions<PHP>) {
		this.maxPhpInstances = options?.maxPhpInstances ?? 5;
		this.phpFactory = options?.phpFactory;
		this.primaryPhp = options?.primaryPhp;
		this.semaphore = new Semaphore({
			concurrency: this.maxPhpInstances,
			/**
			 * Wait up to 5 seconds for resources to become available
			 * before assuming that all the PHP instances are deadlocked.
			 */
			timeout: options?.timeout || 5000,
		});
	}

	/**
	 * Get the primary PHP instance.
	 *
	 * If the primary PHP instance is not set, it will be spawned
	 * using the provided phpFactory.
	 *
	 * @throws {Error} when called twice before the first call is resolved.
	 */
	async getPrimaryPhp() {
		if (!this.phpFactory && !this.primaryPhp) {
			throw new Error(
				'phpFactory or primaryPhp must be set before calling getPrimaryPhp().'
			);
		} else if (!this.primaryPhp) {
			const spawned = await this.spawn!({ isPrimary: true });
			this.primaryPhp = spawned.php;
		}
		return this.primaryPhp!;
	}

	/**
	 * Get a PHP instance.
	 *
	 * It could be either the primary PHP instance, an idle disposable PHP instance,
	 * or a newly spawned PHP instance – depending on the resource availability.
	 *
	 * @throws {MaxPhpInstancesError} when the maximum number of PHP instances is reached
	 *                                and the waiting timeout is exceeded.
	 */
	async acquirePHPInstance(): Promise<SpawnedPHP<PHP>> {
		if (this.primaryIdle) {
			this.primaryIdle = false;
			return {
				php: await this.getPrimaryPhp(),
				reap: () => (this.primaryIdle = true),
			};
		}

		/**
		 * nextInstance is null:
		 *
		 * * Before the first concurrent getInstance() call
		 * * When the last getInstance() call did not have enough
		 *   budget left to optimistically start spawning the next
		 *   instance.
		 */
		const spawnedPhp =
			this.nextInstance || this.spawn({ isPrimary: false });

		/**
		 * Start spawning the next instance if there's still room. We can't
		 * just always spawn the next instance because spawn() can fail
		 * asynchronously and then we'll get an unhandled promise rejection.
		 */
		if (this.semaphore.remaining > 0) {
			this.nextInstance = this.spawn({ isPrimary: false });
		} else {
			this.nextInstance = null;
		}
		return await spawnedPhp;
	}

	/**
	 * Initiated spawning of a new PHP instance.
	 * This function is synchronous on purpose – it needs to synchronously
	 * add the spawn promise to the allInstances array without waiting
	 * for PHP to spawn.
	 */
	private spawn(factoryArgs: PHPFactoryOptions): Promise<SpawnedPHP<PHP>> {
		if (factoryArgs.isPrimary && this.allInstances.length > 0) {
			throw new Error(
				'Requested spawning a primary PHP instance when another primary instance already started spawning.'
			);
		}
		const spawned = this.doSpawn(factoryArgs);
		this.allInstances.push(spawned);
		const pop = () => {
			this.allInstances = this.allInstances.filter(
				(instance) => instance !== spawned
			);
		};
		return spawned
			.catch((rejection) => {
				pop();
				throw rejection;
			})
			.then((result) => ({
				...result,
				reap: () => {
					pop();
					result.reap();
				},
			}));
	}

	/**
	 * Actually acquires the lock and spawns a new PHP instance.
	 */
	private async doSpawn(
		factoryArgs: PHPFactoryOptions
	): Promise<SpawnedPHP<PHP>> {
		let release: () => void;
		try {
			release = await this.semaphore.acquire();
		} catch (error) {
			if (error instanceof AcquireTimeoutError) {
				throw new MaxPhpInstancesError(this.maxPhpInstances);
			}
			throw error;
		}
		try {
			const php = await this.phpFactory!(factoryArgs);
			return {
				php,
				reap() {
					php.exit();
					release();
				},
			};
		} catch (e) {
			release();
			throw e;
		}
	}

	async [Symbol.asyncDispose]() {
		if (this.primaryPhp) {
			this.primaryPhp.exit();
		}
		await Promise.all(
			this.allInstances.map((instance) =>
				instance.then(({ reap }) => reap())
			)
		);
	}
}
