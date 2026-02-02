import { RecommendedPHPVersion } from '@wp-playground/common';
import { loadNodeRuntime } from '..';
import { PHP, PHPProcessManager } from '@php-wasm/universal';

describe('PHPProcessManager', () => {
	let mgr: PHPProcessManager;

	afterEach(async () => {
		if (mgr) {
			await mgr[Symbol.asyncDispose]();
		}
	});

	it('should return the primary PHP instance', async () => {
		mgr = new PHPProcessManager({
			phpFactory: async () =>
				new PHP(await loadNodeRuntime(RecommendedPHPVersion)),
			maxPhpInstances: 4,
		});

		const php = await mgr.getPrimaryPhp();
		expect(php).toBeInstanceOf(PHP);
	});

	it('should spawn new PHP instances', async () => {
		mgr = new PHPProcessManager({
			phpFactory: async () =>
				new PHP(await loadNodeRuntime(RecommendedPHPVersion)),
			maxPhpInstances: 4,
		});

		const php1 = await mgr.acquirePHPInstance();
		expect(php1.php).toBeInstanceOf(PHP);

		const php2 = await mgr.acquirePHPInstance();
		expect(php1.php).not.toBe(php2.php);
	});

	it('should not spawn primary PHP until the first acquire call', async () => {
		const phpFactory = vitest.fn(
			async () => new PHP(await loadNodeRuntime(RecommendedPHPVersion))
		);
		mgr = new PHPProcessManager({
			phpFactory,
			maxPhpInstances: 4,
		});

		expect(phpFactory).not.toHaveBeenCalled();
		await mgr.acquirePHPInstance();
		expect(phpFactory).toHaveBeenCalled();
	});

	it('should refuse to spawn more PHP instances than the maximum (limit=2)', async () => {
		mgr = new PHPProcessManager({
			phpFactory: async () =>
				new PHP(await loadNodeRuntime(RecommendedPHPVersion)),
			maxPhpInstances: 2,
			timeout: 100,
		});

		await mgr.acquirePHPInstance();
		await mgr.acquirePHPInstance();
		await expect(() => mgr.acquirePHPInstance()).rejects.toThrowError(
			/Requested more concurrent PHP instances/
		);
	});

	it('should refuse to spawn more PHP instances than the maximum (limit=3)', async () => {
		mgr = new PHPProcessManager({
			phpFactory: async () =>
				new PHP(await loadNodeRuntime(RecommendedPHPVersion)),
			maxPhpInstances: 3,
			timeout: 100,
		});

		await mgr.acquirePHPInstance();
		await mgr.acquirePHPInstance();
		await mgr.acquirePHPInstance();
		await expect(() => mgr.acquirePHPInstance()).rejects.toThrowError(
			/Requested more concurrent PHP instances/
		);
	});

	it('should reuse idle instances and only spawn when needed', async () => {
		const phpFactory = vitest.fn(
			async () => new PHP(await loadNodeRuntime(RecommendedPHPVersion))
		);
		mgr = new PHPProcessManager({
			phpFactory,
			maxPhpInstances: 5,
		});

		expect(phpFactory).not.toHaveBeenCalled();

		// First acquire spawns primary instance
		const php1 = await mgr.acquirePHPInstance();
		expect(phpFactory).toHaveBeenCalledTimes(1);
		php1.reap();

		// Second acquire reuses the now-idle primary
		const php2 = await mgr.acquirePHPInstance();
		expect(phpFactory).toHaveBeenCalledTimes(1);
		php2.reap();

		// Third acquire reuses primary again
		const php3 = await mgr.acquirePHPInstance();
		expect(phpFactory).toHaveBeenCalledTimes(1);

		// Fourth acquire needs a new instance (primary is busy)
		const php4 = await mgr.acquirePHPInstance();
		expect(phpFactory).toHaveBeenCalledTimes(2);

		php3.reap();
		php4.reap();
	});

	it('should not spawn duplicate primary instances when called concurrently', async () => {
		const phpFactory = vitest.fn(
			async () => new PHP(await loadNodeRuntime(RecommendedPHPVersion))
		);
		mgr = new PHPProcessManager({
			phpFactory,
			maxPhpInstances: 5,
		});

		// Call getPrimaryPhp() twice concurrently - both should return the same instance
		const [php1, php2] = await Promise.all([
			mgr.getPrimaryPhp(),
			mgr.getPrimaryPhp(),
		]);

		expect(php1).toBe(php2);
		expect(phpFactory).toHaveBeenCalledTimes(1);
	});

	it('should correctly queue requests and reuse PHP instances', async () => {
		const phpFactory = vitest.fn(
			async () => new PHP(await loadNodeRuntime(RecommendedPHPVersion))
		);

		/**
		 * To test that PHP requests are queued and instances are reused correctly,
		 * set up the following testing scenario:
		 *   - Pre-boot 2 PHP instances (primary + 1 additional instance).
		 *   - Simulate 6 concurrent, each taking 50ms to complete.
		 *   - Set a timeout to 200ms.
		 *
		 * When the resources are used correctly, 6 requests taking 50ms each
		 * should take 2 instances about 150ms to complete (3x50ms each).
		 */
		mgr = new PHPProcessManager({
			phpFactory,
			maxPhpInstances: 2,
			timeout: 200,
		});

		// Pre-boot the PHP instances so that they are ready to process requests.
		const { reap: reap1 } = await mgr.acquirePHPInstance();
		const { reap: reap2 } = await mgr.acquirePHPInstance();
		reap1();
		reap2();

		// Simulate 6 concurrent requests, each taking 50ms.
		const simulateRequest = async () => {
			const { php, reap } = await mgr.acquirePHPInstance();
			await new Promise((resolve) => setTimeout(resolve, 50));
			reap();
			return php;
		};

		const results = await Promise.all([
			simulateRequest(),
			simulateRequest(),
			simulateRequest(),
			simulateRequest(),
			simulateRequest(),
			simulateRequest(),
		]);

		// All 6 requests should complete successfully within the 200ms timeout.
		expect(results).toHaveLength(6);
		results.forEach((php) => expect(php).toBeInstanceOf(PHP));

		// Only 2 instances should have been spawned (reused for all 6 requests).
		expect(phpFactory).toHaveBeenCalledTimes(2);
	});
});
