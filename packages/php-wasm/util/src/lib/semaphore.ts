import { SleepFinished, sleep } from './sleep';

export interface SemaphoreOptions {
	/**
	 * The maximum number of concurrent locks.
	 */
	concurrency: number;
	/**
	 * The maximum time to wait for a lock to become available.
	 */
	timeout?: number;
}

export class AcquireTimeoutError extends Error {
	constructor() {
		super('Acquiring lock timed out');
	}
}

export default class Semaphore {
	private _running = 0;
	private concurrency: number;
	private timeout?: number;
	private queue: (() => void)[];

	constructor({ concurrency, timeout }: SemaphoreOptions) {
		this.concurrency = concurrency;
		this.timeout = timeout;
		this.queue = [];
	}

	get remaining(): number {
		return this.concurrency - this.running;
	}

	get running(): number {
		return this._running;
	}

	async acquire(): Promise<() => void> {
		// Concurrency exhausted - wait in queue for other workers to finish:
		if (this._running >= this.concurrency) {
			// Create a promise and store its resolver in the queue.
			const acquired = new Promise<void>((resolve) => {
				this.queue.push(resolve);
			});

			// Wait until it is resolved by another worker or a timeout occurs.
			if (this.timeout !== undefined) {
				// Store the resolver for cleanup in case of timeout.
				const resolve = this.queue.at(-1)!;
				const result = await Promise.race([
					acquired,
					sleep(this.timeout),
				]);
				if (result === SleepFinished) {
					// Remove the resolver for the timed out worker from the queue.
					this.queue.splice(this.queue.indexOf(resolve), 1);
					throw new AcquireTimeoutError();
				}
			} else {
				await acquired;
			}
		}

		// Acquire the lock:
		this._running++;
		let released = false;

		// Return a release function:
		return () => {
			if (released) {
				return;
			}
			released = true;
			this._running--;

			// Release the first item in the queue (call its resolver):
			if (this.queue.length > 0) {
				this.queue.shift()!();
			}
		};
	}

	async run<T>(fn: () => T | Promise<T>): Promise<T> {
		const release = await this.acquire();
		try {
			return await fn();
		} finally {
			release();
		}
	}
}
