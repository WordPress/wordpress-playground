export interface SemaphoreOptions {
	concurrency: number;
	requestsPerInterval?: number;
	intervalMs?: number;
}

export default class Semaphore {
	private running = 0;
	private concurrency: number;
	private requestsPerInterval: number;
	private intervalMs: number;
	private queue: (() => void)[];
	private timestampQueue: number[];

	constructor({
		concurrency,
		requestsPerInterval = 1000,
		intervalMs = 1,
	}: SemaphoreOptions) {
		this.concurrency = concurrency;
		this.requestsPerInterval = requestsPerInterval;
		this.intervalMs = intervalMs;
		this.queue = [];
		this.timestampQueue = [];
	}

	async acquire(): Promise<() => void> {
		while (true) {
			// Sliding time window – remove the old timestamps:
			const now = Date.now();
			while (
				this.timestampQueue.length > 0 &&
				now - this.timestampQueue[0] > this.intervalMs
			) {
				this.timestampQueue.shift();
			}

			if (this.running >= this.concurrency) {
				// Concurrency exhausted – wait until a lock is released:
				await new Promise<void>((resolve) => this.queue.push(resolve));
			} else if (this.timestampQueue.length >= this.requestsPerInterval) {
				// Sliding time window exhausted – wait until the oldest timestamp is old enough:
				await sleep(this.timestampQueue[0] + this.intervalMs - now);
			} else {
				// Acquire the lock:
				this.running++;
				this.timestampQueue.push(Date.now());
				return () => {
					this.running--;
					// Release the lock:
					if (this.queue.length > 0) {
						this.queue.shift()!();
					}
				};
			}
		}
	}
}

function sleep(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
