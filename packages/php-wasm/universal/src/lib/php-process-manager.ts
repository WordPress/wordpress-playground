import { AcquireTimeoutError, Semaphore } from '@php-wasm/util';
import type { PHP } from './php';
import type { PHPInstanceManager, AcquiredPHP } from './php-instance-manager';

export type PHPFactoryOptions = {
	isPrimary: boolean;
};

export type PHPFactory = (options: PHPFactoryOptions) => Promise<PHP>;

export interface ProcessManagerOptions {
	/**
	 * The maximum number of PHP instances that can be in use at
	 * the same time.
	 */
	maxPhpInstances?: number;
	/**
	 * The number of milliseconds to wait for a PHP instance when
	 * all instances are busy. If the timeout is reached, we assume
	 * all the PHP instances are deadlocked and throw MaxPhpInstancesError.
	 *
	 * Default: 30000
	 */
	timeout?: number;
	/**
	 * A factory function used for spawning new PHP instances.
	 */
	phpFactory?: PHPFactory;
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
 * A PHP Process manager that maintains a pool of reusable PHP instances.
 *
 * Instances are spawned on demand up to `maxPhpInstances` and reused across
 * requests. The first instance spawned is the "primary" instance which
 * contains the reference filesystem used by all other instances.
 *
 * The semaphore controls how many requests can be processed concurrently.
 * When all instances are busy, new requests wait in a queue until an
 * instance becomes available or the timeout is reached.
 */
export class PHPProcessManager implements PHPInstanceManager {
	/** All PHP instances that have been spawned. */
	private instances: PHP[] = [];

	/** Instances that are currently idle and available for use. */
	private idleInstances: PHP[] = [];

	/** Maximum number of concurrent PHP instances allowed. */
	private maxPhpInstances: number;

	/** Factory function for creating new PHP instances. */
	private phpFactory?: PHPFactory;

	/** Controls concurrent access to PHP instances. */
	private semaphore: Semaphore;

	/** Prevents spawning duplicate primary instances during concurrent calls. */
	private primaryPhpPromise?: Promise<PHP>;

	constructor(options?: ProcessManagerOptions) {
		this.maxPhpInstances = options?.maxPhpInstances ?? 2;
		this.phpFactory = options?.phpFactory;
		this.semaphore = new Semaphore({
			concurrency: this.maxPhpInstances,
			timeout: options?.timeout || 30000,
		});
	}

	/**
	 * Get the primary PHP instance (the first one spawned).
	 * If no instance exists yet, one will be spawned and marked as idle.
	 */
	async getPrimaryPhp(): Promise<PHP> {
		if (this.instances.length > 0) {
			return this.instances[0];
		}

		if (!this.primaryPhpPromise) {
			this.primaryPhpPromise = this.spawnInstance(true);
		}
		try {
			return await this.primaryPhpPromise;
		} finally {
			this.primaryPhpPromise = undefined;
		}
	}

	/**
	 * Acquire a PHP instance for processing a request.
	 *
	 * Returns an idle instance from the pool, or spawns a new one if
	 * the pool isn't at capacity. If all instances are busy, waits
	 * until one becomes available.
	 *
	 * @throws {MaxPhpInstancesError} when the timeout is reached waiting
	 *                                for an available instance.
	 */
	async acquirePHPInstance(): Promise<AcquiredPHP> {
		let releaseSemaphore: () => void;
		try {
			releaseSemaphore = await this.semaphore.acquire();
		} catch (error) {
			if (error instanceof AcquireTimeoutError) {
				throw new MaxPhpInstancesError(this.maxPhpInstances);
			}
			throw error;
		}

		const php = await this.getOrSpawnInstance();
		return {
			php,
			reap: () => {
				this.idleInstances.push(php);
				releaseSemaphore();
			},
		};
	}

	/**
	 * Get an idle instance or spawn a new one.
	 */
	private async getOrSpawnInstance(): Promise<PHP> {
		if (this.instances.length === 0) {
			await this.getPrimaryPhp();
		}
		if (this.idleInstances.length === 0) {
			await this.spawnInstance(false);
		}
		return this.idleInstances.pop()!;
	}

	/**
	 * Spawn a new PHP instance.
	 */
	private async spawnInstance(isPrimary: boolean): Promise<PHP> {
		if (!this.phpFactory) {
			throw new Error(
				'phpFactory must be set before spawning instances.'
			);
		}
		const php = await this.phpFactory({ isPrimary });
		this.instances.push(php);
		this.idleInstances.push(php);
		return php;
	}

	async [Symbol.asyncDispose]() {
		for (const php of this.instances) {
			php.exit();
		}
		this.instances = [];
		this.idleInstances = [];
	}
}
