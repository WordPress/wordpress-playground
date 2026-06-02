import { RecommendedPHPVersion } from '@wp-playground/common';
import { loadNodeRuntime } from '..';
import {
	PHP,
	PHPProcessManager,
	SinglePHPInstanceManager,
} from '@php-wasm/universal';

describe('SinglePHPInstanceManager', () => {
	it('should return the PHP instance passed in the constructor', async () => {
		const php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
		const mgr = new SinglePHPInstanceManager({ php });

		const primaryPhp = await mgr.getPrimaryPhp();
		expect(primaryPhp).toBe(php);
	});

	it('should create a PHP instance using the factory when no instance is provided', async () => {
		const phpFactory = vitest.fn(
			async () => new PHP(await loadNodeRuntime(RecommendedPHPVersion))
		);
		const mgr = new SinglePHPInstanceManager({ phpFactory });

		expect(phpFactory).not.toHaveBeenCalled();
		const php = await mgr.getPrimaryPhp();
		expect(phpFactory).toHaveBeenCalledTimes(1);
		expect(php).toBeInstanceOf(PHP);
	});

	it('should return the same PHP instance on subsequent getPrimaryPhp calls', async () => {
		const phpFactory = vitest.fn(
			async () => new PHP(await loadNodeRuntime(RecommendedPHPVersion))
		);
		const mgr = new SinglePHPInstanceManager({ phpFactory });

		const php1 = await mgr.getPrimaryPhp();
		const php2 = await mgr.getPrimaryPhp();
		expect(php1).toBe(php2);
		expect(phpFactory).toHaveBeenCalledTimes(1);
	});

	it('should acquire and release the PHP instance', async () => {
		const php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
		const mgr = new SinglePHPInstanceManager({ php });

		const acquired = await mgr.acquirePHPInstance();
		expect(acquired.php).toBe(php);

		acquired.reap();

		// Should be able to acquire again after reaping
		const acquired2 = await mgr.acquirePHPInstance();
		expect(acquired2.php).toBe(php);
	});

	it('should throw an error when trying to acquire twice without reaping', async () => {
		const php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
		const mgr = new SinglePHPInstanceManager({ php });

		await mgr.acquirePHPInstance();
		await expect(() => mgr.acquirePHPInstance()).rejects.toThrowError(
			/already acquired/
		);
	});

	it('should throw an error when neither php nor phpFactory is provided', () => {
		expect(() => new SinglePHPInstanceManager({})).toThrowError(
			/requires either php or phpFactory/
		);
	});

	it('should only call the factory once even with concurrent getPrimaryPhp calls', async () => {
		const phpFactory = vitest.fn(
			async () => new PHP(await loadNodeRuntime(RecommendedPHPVersion))
		);
		const mgr = new SinglePHPInstanceManager({ phpFactory });

		// Make concurrent calls
		const [php1, php2, php3] = await Promise.all([
			mgr.getPrimaryPhp(),
			mgr.getPrimaryPhp(),
			mgr.getPrimaryPhp(),
		]);

		expect(phpFactory).toHaveBeenCalledTimes(1);
		expect(php1).toBe(php2);
		expect(php2).toBe(php3);
	});
});

describe('PHPProcessManager', () => {
	it('should return the primary PHP instance', async () => {
		const mgr = new PHPProcessManager({
			phpFactory: async () =>
				new PHP(await loadNodeRuntime(RecommendedPHPVersion)),
			maxPhpInstances: 4,
		});

		const php = await mgr.getPrimaryPhp();
		expect(php).toBeInstanceOf(PHP);
	});

	it('should spawn new PHP instances', async () => {
		const mgr = new PHPProcessManager({
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
		const mgr = new PHPProcessManager({
			phpFactory,
			maxPhpInstances: 4,
		});

		expect(phpFactory).not.toHaveBeenCalled();
		await mgr.acquirePHPInstance();
		expect(phpFactory).toHaveBeenCalled();
	});

	it('should refuse to spawn more PHP instances than the maximum (limit=2)', async () => {
		const mgr = new PHPProcessManager({
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
		const mgr = new PHPProcessManager({
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
		const mgr = new PHPProcessManager({
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
		const mgr = new PHPProcessManager({
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
});
