import { HarvestedInstancePool } from './harvested-instance-pool';

describe('ResourcePool', () => {
	describe('runs tasks as the resources are getting destroyed and replaced', async () => {
		describe('"concurrently"', async () => {
			it('maxInstances=1, maxTasksPerInstance=1', async () => {
				let id = 0;
				const pool = await HarvestedInstancePool.create({
					maxInstances: 1,
					maxTasksPerInstance: 1,
					create: () => 'resource' + ++id,
				});
				const runner1 = vitest.fn();
				const runner2 = vitest.fn();
				const runner3 = vitest.fn();
				await Promise.all([
					pool.runTask(runner1),
					pool.runTask(runner2),
					pool.runTask(runner3),
				]);
				expect(runner1).toHaveBeenCalledWith('resource1');
				expect(runner2).toHaveBeenCalledWith('resource2');
				expect(runner3).toHaveBeenCalledWith('resource3');
			});

			it('maxInstances=2, maxTasksPerInstance=1', async () => {
				let id = 0;
				const pool = await HarvestedInstancePool.create({
					maxInstances: 2,
					maxTasksPerInstance: 2,
					create: () => 'resource' + ++id,
				});
				const runner1 = vitest.fn();
				const runner2 = vitest.fn();
				const runner3 = vitest.fn();
				const runner4 = vitest.fn();
				const runner5 = vitest.fn();
				await Promise.all([
					pool.runTask(runner1),
					pool.runTask(runner2),
					pool.runTask(runner3),
					pool.runTask(runner4),
					pool.runTask(runner5),
				]);
				expect(runner1).toHaveBeenCalledWith('resource1');
				expect(runner2).toHaveBeenCalledWith('resource2');
				expect(runner3).toHaveBeenCalledWith('resource1');
				expect(runner4).toHaveBeenCalledWith('resource2');
				expect(runner5).toHaveBeenCalledWith('resource3');
			});
		});
		describe('serially', async () => {
			it('maxInstances=1, maxTasksPerInstance=1', async () => {
				let id = 0;
				const pool = await HarvestedInstancePool.create({
					maxInstances: 1,
					maxTasksPerInstance: 1,
					create: () => 'resource' + ++id,
				});
				const runner1 = vitest.fn();
				const runner2 = vitest.fn();
				const runner3 = vitest.fn();
				await pool.runTask(runner1);
				await pool.runTask(runner2);
				await pool.runTask(runner3);
				expect(runner1).toHaveBeenCalledWith('resource1');
				expect(runner2).toHaveBeenCalledWith('resource2');
				expect(runner3).toHaveBeenCalledWith('resource3');
			});

			it('maxInstances=2, maxTasksPerInstance=1', async () => {
				let id = 0;
				const pool = await HarvestedInstancePool.create({
					maxInstances: 2,
					maxTasksPerInstance: 2,
					create: () => 'resource' + ++id,
				});
				const runner1 = vitest.fn();
				const runner2 = vitest.fn();
				const runner3 = vitest.fn();
				const runner4 = vitest.fn();
				const runner5 = vitest.fn();
				await pool.runTask(runner1);
				await pool.runTask(runner2);
				await pool.runTask(runner3);
				await pool.runTask(runner4);
				await pool.runTask(runner5);
				expect(runner1).toHaveBeenCalledWith('resource1');
				expect(runner2).toHaveBeenCalledWith('resource2');
				expect(runner3).toHaveBeenCalledWith('resource1');
				// At this point, resource3 is the least utilized one
				// with 0 handled tasks – therefore it will be the
				// first one to be used.
				expect(runner4).toHaveBeenCalledWith('resource3');
				expect(runner5).toHaveBeenCalledWith('resource2');
			});
		});
	});

	it('should destroy resources that have exceeded their tasks limit', async () => {
		const destroy = vitest.fn();
		const pool = await HarvestedInstancePool.create({
			maxInstances: 1,
			maxTasksPerInstance: 1,
			create: () => 'resource',
			destroy,
		});
		await pool.runTask(() => {});
		await pool.runTask(() => {});

		expect(destroy).toHaveBeenCalledWith('resource');
	});
});
