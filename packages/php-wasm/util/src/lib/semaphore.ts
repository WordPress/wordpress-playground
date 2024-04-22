import { SleepFinished, sleep } from './sleep';

export interface SemaphoreOptions {
	concurrency: number;
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
		while (true) {
			if (this._running >= this.concurrency) {
				// Concurrency exhausted – wait until a lock is released:
				const acquired = new Promise<void>((resolve) => {
					this.queue.push(resolve);
				});
				if (this.timeout !== undefined) {
					await Promise.race([acquired, sleep(this.timeout)]).then(
						(value) => {
							if (value === SleepFinished) {
								throw new AcquireTimeoutError();
							}
						}
					);
				} else {
					await acquired;
				}
			} else {
				// Acquire the lock:
				this._running++;
				let released = false;
				return () => {
					if (released) {
						return;
					}
					released = true;
					this._running--;
					// Release the lock:
					if (this.queue.length > 0) {
						this.queue.shift()!();
					}
				};
			}
		}
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
