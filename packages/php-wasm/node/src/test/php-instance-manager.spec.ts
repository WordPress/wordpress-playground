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

	it('should not start a second PHP instance until the first getInstance() call when the primary instance is busy', async () => {
		const phpFactory = vitest.fn(
			async () => new PHP(await loadNodeRuntime(RecommendedPHPVersion))
		);
		const mgr = new PHPProcessManager({
			phpFactory,
			maxPhpInstances: 5,
		});

		expect(phpFactory).not.toHaveBeenCalled();
		const php1 = await mgr.acquirePHPInstance();
		expect(phpFactory).toHaveBeenCalledTimes(1);
		php1.reap();

		const php2 = await mgr.acquirePHPInstance();
		expect(phpFactory).toHaveBeenCalledTimes(1);
		php2.reap();

		await mgr.acquirePHPInstance();
		await mgr.acquirePHPInstance();
		expect(phpFactory).toHaveBeenCalledTimes(3);
	});

	it('should refuse to spawn two primary PHP instances', async () => {
		const mgr = new PHPProcessManager({
			phpFactory: async () =>
				new PHP(await loadNodeRuntime(RecommendedPHPVersion)),
			maxPhpInstances: 5,
		});

		// A synchronous call. Do not await this promise on purpose.
		mgr.getPrimaryPhp();

		// No await here, because we want to check if a second,
		// synchronous call throws an error if issued before
		// the first call completes asynchronously.
		try {
			mgr.getPrimaryPhp();
		} catch (e) {
			expect(e).toBeInstanceOf(Error);
			expect((e as Error).message).toContain(
				'Requested spawning a primary PHP instance'
			);
		}
	});
});
