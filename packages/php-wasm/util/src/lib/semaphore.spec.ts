import Semaphore, { AcquireTimeoutError } from './semaphore';

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
});
