import { Semaphore } from '@php-wasm/util';
import { BasePHP } from './base-php';

export type PHPFactoryArgs = {
	isPrimary: boolean;
};

export type PHPFactory<PHP extends BasePHP> = ({
	isPrimary,
}: PHPFactoryArgs) => Promise<PHP>;

export interface ProcessManagerOptions<PHP extends BasePHP> {
	maxPhpInstances?: number;
	timeout?: number;
	primaryPhp?: PHP;
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
		this.name = 'MaxPhpInstancesError';
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
export class PHPProcessManager<PHP extends BasePHP> implements Disposable {
	private primaryPhp?: PHP;
	private primaryIdle = true;
	private nextInstance: Promise<SpawnedPHP<PHP>> | null = null;
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

	setPhpFactory(phpFactory: () => Promise<PHP>) {
		this.phpFactory = phpFactory;
	}

	async getInstance(): Promise<SpawnedPHP<PHP>> {
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
		}
		return await spawnedPhp;
	}

	private spawn(factoryArgs: PHPFactoryArgs): Promise<SpawnedPHP<PHP>> {
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

	private async doSpawn(
		factoryArgs: PHPFactoryArgs
	): Promise<SpawnedPHP<PHP>> {
		let release: () => void;
		try {
			release = await this.semaphore.acquire();
		} catch (error) {
			throw new MaxPhpInstancesError(this.maxPhpInstances);
		}
		const php = await this.phpFactory!(factoryArgs);
		return {
			php,
			reap() {
				php.exit();
				release();
			},
		};
	}

	async [Symbol.dispose]() {}

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
