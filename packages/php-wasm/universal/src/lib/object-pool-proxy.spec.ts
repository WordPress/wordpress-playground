import { describe, it, expect } from 'vitest';
import { createObjectPoolProxy } from './object-pool-proxy';

describe('createPoolProxy', () => {
	it('throws if no instances are provided', () => {
		expect(() => createObjectPoolProxy([])).toThrow(
			'At least one instance is required'
		);
	});

	it('proxies synchronous method calls', async () => {
		const instance = {
			add(a: number, b: number) {
				return a + b;
			},
		};
		const proxy = createObjectPoolProxy([instance]);
		const result = await proxy.add(2, 3);
		expect(result).toBe(5);
	});

	it('proxies async method calls', async () => {
		const instance = {
			async fetch(id: number) {
				return `item-${id}`;
			},
		};
		const proxy = createObjectPoolProxy([instance]);
		const result = await proxy.fetch(7);
		expect(result).toBe('item-7');
	});

	it('proxies property reads', async () => {
		const instance = { value: 42, name: 'test' };
		const proxy = createObjectPoolProxy([instance]);
		expect(await proxy.value).toBe(42);
		expect(await proxy.name).toBe('test');
	});

	it('distributes calls across instances', async () => {
		const calls: number[] = [];
		const instances = [0, 1, 2].map((id) => ({
			async work() {
				calls.push(id);
				await new Promise((r) => setTimeout(r, 20));
				return id;
			},
		}));

		const proxy = createObjectPoolProxy(instances);
		const results = await Promise.all([
			proxy.work(),
			proxy.work(),
			proxy.work(),
		]);

		// All 3 instances should be used
		expect(calls.sort()).toEqual([0, 1, 2]);
		expect(results.sort()).toEqual([0, 1, 2]);
	});

	it('allows only one concurrent access per instance', async () => {
		let concurrent = 0;
		let maxConcurrent = 0;

		const instance = {
			async work() {
				concurrent++;
				maxConcurrent = Math.max(maxConcurrent, concurrent);
				await new Promise((r) => setTimeout(r, 20));
				concurrent--;
				return 'done';
			},
		};

		const proxy = createObjectPoolProxy([instance]);
		await Promise.all([proxy.work(), proxy.work(), proxy.work()]);

		expect(maxConcurrent).toBe(1);
	});

	it('queues when all instances are busy', async () => {
		let activeCount = 0;
		let maxActive = 0;

		const instances = [0, 1].map((id) => ({
			async work() {
				activeCount++;
				maxActive = Math.max(maxActive, activeCount);
				await new Promise((r) => setTimeout(r, 20));
				activeCount--;
				return id;
			},
		}));

		const proxy = createObjectPoolProxy(instances);

		// Fire 4 calls with only 2 instances
		const results = await Promise.all([
			proxy.work(),
			proxy.work(),
			proxy.work(),
			proxy.work(),
		]);

		expect(maxActive).toBe(2);
		expect(results).toHaveLength(4);
	});

	it('releases the instance after a sync error', async () => {
		const instance = {
			fail() {
				throw new Error('sync boom');
			},
			ok() {
				return 'fine';
			},
		};

		const proxy = createObjectPoolProxy([instance]);
		await expect(proxy.fail()).rejects.toThrow('sync boom');
		// Instance should be released and available
		expect(await proxy.ok()).toBe('fine');
	});

	it('releases the instance after an async error', async () => {
		const instance = {
			async fail() {
				throw new Error('async boom');
			},
			ok() {
				return 'fine';
			},
		};

		const proxy = createObjectPoolProxy([instance]);
		await expect(proxy.fail()).rejects.toThrow('async boom');
		expect(await proxy.ok()).toBe('fine');
	});

	it('holds the lock until an async method resolves', async () => {
		const accessLog: string[] = [];

		const instance = {
			async slowWork(label: string) {
				accessLog.push(`start-${label}`);
				await new Promise((r) => setTimeout(r, 30));
				accessLog.push(`end-${label}`);
			},
		};

		const proxy = createObjectPoolProxy([instance]);
		await Promise.all([proxy.slowWork('a'), proxy.slowWork('b')]);

		// Calls must serialize, not interleave
		expect(accessLog).toEqual(['start-a', 'end-a', 'start-b', 'end-b']);
	});

	it('is not treated as a thenable', async () => {
		const instance = { value: 1 };
		const proxy = createObjectPoolProxy([instance]);

		// If proxy.then existed, Promise.resolve would try to
		// "adopt" it, causing hangs or unexpected behavior
		const result = await Promise.resolve(proxy);
		expect(result).toBe(proxy);
	});

	it('unwraps already-promised return types', async () => {
		const instance = {
			async fetchData(): Promise<string> {
				return 'data';
			},
		};

		const proxy = createObjectPoolProxy([instance]);
		const result = await proxy.fetchData();
		expect(result).toBe('data');
	});

	it('reuses freed instances for queued work', async () => {
		const usageCounts = [0, 0];

		const instances = [0, 1].map((id) => ({
			async work() {
				usageCounts[id]++;
				await new Promise((r) => setTimeout(r, 10));
				return id;
			},
		}));

		const proxy = createObjectPoolProxy(instances);

		// 6 calls across 2 instances — each should be used ~3 times
		await Promise.all(Array.from({ length: 6 }, () => proxy.work()));

		expect(usageCounts[0]).toBe(3);
		expect(usageCounts[1]).toBe(3);
	});

	it('distributes property reads through the pool', async () => {
		const instanceA = { value: 'a' };
		const instanceB = { value: 'b' };

		const proxy = createObjectPoolProxy([instanceA, instanceB]);

		// Two sequential reads should hit each instance once
		const first = await proxy.value;
		const second = await proxy.value;

		expect([first, second].sort()).toEqual(['a', 'b']);
	});
});
