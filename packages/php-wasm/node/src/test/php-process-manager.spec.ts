import { RecommendedPHPVersion } from '@wp-playground/common';
import { loadNodeRuntime } from '..';
import { PHP, PHPProcessManager } from '@php-wasm/universal';

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
