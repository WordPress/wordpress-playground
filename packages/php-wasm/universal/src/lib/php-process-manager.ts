import { BasePHP } from './base-php';

export interface ProcessManagerOptions {
	maxPhpInstances?: number;
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
 * When a new request comes in, PhpWasmFpm grabs an idle instance to handle it and
 * initializes a new idle instance asynchronously. In other words, for n concurrent
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
export class PHPProcessManager<PHP extends BasePHP> {
	primaryPhp?: PHP;
	private primaryIdle = true;
	private seenConcurrentRequest = false;
	private nextInstance: Promise<PHP> | null = null;
	private phpFactory?: () => Promise<PHP>;
	private maxPhpInstances: number;
	private activePhpInstances = 1;

	constructor(options?: ProcessManagerOptions) {
		this.maxPhpInstances = options?.maxPhpInstances ?? 5;
	}

	setPrimaryPhp(primaryPhp: PHP) {
		this.primaryPhp = primaryPhp;
	}

	setPhpFactory(phpFactory: () => Promise<PHP>) {
		this.phpFactory = phpFactory;
	}

	async spawn(): Promise<SpawnedPHP<PHP>> {
		if (this.activePhpInstances >= this.maxPhpInstances) {
			throw new MaxPhpInstancesError(this.maxPhpInstances);
		}

		if (!this.phpFactory || !this.primaryPhp) {
			throw new Error(
				'phpFactory and primaryPhp must be set before calling acquire().'
			);
		}

		let php: PHP | null = null;
		if (this.primaryIdle) {
			php = this.primaryPhp;
			this.primaryIdle = false;
		} else {
			if (!this.seenConcurrentRequest) {
				this.seenConcurrentRequest = true;
				this.nextInstance = this.phpFactory();
				++this.activePhpInstances;
			}
			const phpPromise = this.nextInstance!;
			this.nextInstance = this.phpFactory();
			++this.activePhpInstances;
			php = await phpPromise;
		}

		return {
			php,
			reap: () => {
				if (php === this.primaryPhp) {
					this.primaryIdle = true;
				} else {
					--this.activePhpInstances;
					php!.exit();
				}
			},
		};
	}
}
