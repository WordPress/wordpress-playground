/**
 * Tracks stats of instances in a pool.
 * @private
 */
class HarvestedInstance<InstanceType> {
	/** The underlying resource. */
	instance: InstanceType;
	/** Total tasks processed. */
	handledTasks = 0;
	/** Whether instance is busy handling a request at the moment. */
	busy = false;
	constructor(instance: InstanceType) {
		this.instance = instance;
	}
}

type InstanceLock<Instance> = {
	instance: HarvestedInstance<Instance>;
	release: () => Promise<void>;
};

interface PoolOptions<Instance> {
	create: () => Promise<Instance> | Instance;
	destroy?: (instance: Instance) => Promise<void> | void;
	maxInstances: number;
	maxTasksPerInstance: number;
}

/**
 * Maintains and refreshes a list of php instances such that each one will only
 * be fed X number of tasks before being discarded and replaced.
 *
 * Since we're dealing with a linear, "physical" memory array, as opposed to a
 * virtual memory system afforded by most modern OSes, we're prone to things
 * like memory fragmentation. In that situation, we could have the entire
 * gigabyte empty except for a few sparse allocations. If no contiguous region
 * of memory exists for the length requested, memory allocations will fail.
 * This tends to happen when a new request attempts to initialize a heap
 * structure but cannot find a contiguous 2mb chunk of memory.
 *
 * We can go as far as debugging PHP itself, and contributing the fix upstream.
 * But even in this case we cannot guarantee that a third party extension will
 * not introduce a leak sometime in the future. Therefore, we should have a
 * solution robust to memory leaks that come from upstream code. I think that
 * following the native strategy is the best way.
 *
 * https://www.php.net/manual/en/install.fpm.configuration.php#pm.max-tasks
 */
export class HarvestedInstancePool<InstanceType> {
	private pool: Set<HarvestedInstance<InstanceType>> = new Set();

	/**
	 * A queue of promises waiting to be resolved with an idle resource.
	 */
	private queue: Array<(lock: InstanceLock<InstanceType>) => any> = [];

	public static async create<InstanceType>(
		options: PoolOptions<InstanceType>
	) {
		const pool = new HarvestedInstancePool<InstanceType>(options);
		await pool.populate();
		return pool;
	}
	private constructor(private options: PoolOptions<InstanceType>) {}

	/**
	 * Queue up a callback that will make a request when an
	 * instance becomes idle.
	 * @param item Callback to run when intance becomes available. Should accept the instance as the first and only param, and return a promise that resolves when the request is complete.
	 * @public
	 */
	async runTask(callback: (php: InstanceType) => any) {
		// Wait for the next available instance.
		const { instance, release } = await new Promise<
			InstanceLock<InstanceType>
		>((resolve) => {
			this.queue.push(resolve);
			this.startNextTask();
		});

		try {
			return await callback(instance.instance);
		} finally {
			await release();
			this.startNextTask();
		}
	}

	private startNextTask() {
		if (this.queue.length === 0) {
			return;
		}
		const lock = this.lockIdleInstance();
		if (lock) {
			this.queue.shift()!(lock);
		}
	}

	private lockIdleInstance() {
		// Find the first available idle instance.
		const instance = Array.from(this.pool)
			.filter((instance) => !instance.busy)
			.sort((a, b) => a.handledTasks - b.handledTasks)[0];

		if (!instance) {
			// Bale out if all the instances are busy.
			// runTask() will call this method again when an instance becomes idle.
			return;
		}

		instance.busy = true;
		const release = async () => {
			// Destroy the instance if it has exceeded its max tasks
			if (++instance.handledTasks >= this.options.maxTasksPerInstance) {
				await this.options.destroy?.(instance.instance);
				this.pool.delete(instance);
				await this.populate();
			}
			instance.busy = false;
		};
		return { instance, release };
	}

	private async populate() {
		// Create new instances if we don't have enough.
		while (this.pool.size < this.options.maxInstances) {
			const instance = await this.options.create();
			this.pool.add(new HarvestedInstance(instance));
		}
	}
}
