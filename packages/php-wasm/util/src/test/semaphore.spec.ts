import Semaphore, { AcquireTimeoutError } from '../lib/semaphore';

describe('RequestsPerIntervaledSemaphore', () => {
	it('should limit the number of concurrent lock holders', async () => {
		const concurrency = 2;
		const semaphore = new Semaphore({
			concurrency,
		});

		let concurrentTasks = 0;
		let concurrencyTasks = 0;

		async function performTask() {
			const release = await semaphore.acquire();
			concurrentTasks++;

			concurrencyTasks = Math.max(concurrencyTasks, concurrentTasks);
			await new Promise((resolve) => setTimeout(resolve, 10));

			concurrentTasks--;
			release();
		}

		const tasks = Array.from({ length: 10 }, () => performTask());
		await Promise.all(tasks);

		expect(concurrencyTasks).toBe(concurrency);
	});
	it('should not be possible to release twice', async () => {
		const concurrency = 2;
		const semaphore = new Semaphore({
			concurrency,
		});

		const release1 = await semaphore.acquire();
		await semaphore.acquire();

		release1();
		release1();

		expect(semaphore.running).toBe(1);
	});
	it('should wait for the lock no longer than the timeout', async () => {
		const semaphore = new Semaphore({
			concurrency: 1,
			timeout: 1,
		});

		await semaphore.acquire();
		expect(() => semaphore.acquire()).rejects.toThrow(AcquireTimeoutError);
	});

	it('should not leave stale resolvers in queue after timeout', async () => {
		const semaphore = new Semaphore({
			concurrency: 1,
			timeout: 5,
		});

		// Acquire the only slot
		const release = await semaphore.acquire();

		// This waiter will timeout (stale resolver bug would leave it in queue)
		await expect(semaphore.acquire()).rejects.toThrow(AcquireTimeoutError);

		// Start a new waiter - should get the slot when released
		const waiter = semaphore.acquire();

		// Release the slot
		release();

		// The new waiter should succeed (not timeout waiting behind stale resolver)
		const releaseWaiter = await waiter;
		releaseWaiter();
	});
});
