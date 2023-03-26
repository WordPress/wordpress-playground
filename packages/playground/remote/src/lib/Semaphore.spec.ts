import Semaphore from './Semaphore';

describe('RequestsPerIntervaledSemaphore', () => {
	it('should limit the number of concurrent lock holders', async () => {
		const concurrency = 2;
		const requestsPerInterval = 5;
		const intervalMs = 100;
		const semaphore = new Semaphore({
			concurrency,
			requestsPerInterval,
			intervalMs,
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

	it('should limit the maximum number of acquires per unit of time', async () => {
		const concurrency = 50;
		const requestsPerInterval = 3;
		const intervalMs = 100;
		const semaphore = new Semaphore({
			concurrency,
			requestsPerInterval,
			intervalMs,
		});

		let acquiredCount = 0;
		let requestsPerIntervaledCount = 0;

		async function performTask() {
			const release = await semaphore.acquire();
			acquiredCount++;
			requestsPerIntervaledCount = Math.max(
				requestsPerIntervaledCount,
				acquiredCount
			);
			await new Promise((resolve) => setTimeout(resolve, 8));
			acquiredCount--;
			release();
		}

		const tasks = [];
		for (let i = 0; i < 10; i++) {
			tasks.push(performTask());
		}
		await Promise.all(tasks);

		expect(requestsPerIntervaledCount).toBe(requestsPerInterval);
	});

});
