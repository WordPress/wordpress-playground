import { RecommendedPHPVersion } from '@wp-playground/wordpress';
import { NodePHP } from '..';
import { PHPProcessManager } from '@php-wasm/universal';

describe('PHPProcessManager', () => {
	it('should spawn new PHP instances', async () => {
		const mgr = new PHPProcessManager({
			phpFactory: async () => NodePHP.load(RecommendedPHPVersion),
			maxPhpInstances: 4,
		});

		const php1 = await mgr.acquirePHPInstance();
		expect(php1.php).toBeInstanceOf(NodePHP);

		const php2 = await mgr.acquirePHPInstance();
		expect(php1.php).not.toBe(php2.php);
	});

	it('should not spawn primary PHP until the first acquire call', async () => {
		const phpFactory = vitest.fn(async () =>
			NodePHP.load(RecommendedPHPVersion)
		);
		const mgr = new PHPProcessManager({
			phpFactory,
			maxPhpInstances: 4,
		});

		expect(phpFactory).not.toHaveBeenCalled();
		await mgr.acquirePHPInstance();
		expect(phpFactory).toHaveBeenCalled();
	});

	it('should refuse to spawn more PHP instances than the maximum', async () => {
		const mgr = new PHPProcessManager({
			phpFactory: async () => NodePHP.load(RecommendedPHPVersion),
			maxPhpInstances: 2,
			timeout: 100,
		});

		await mgr.acquirePHPInstance();
		await mgr.acquirePHPInstance();
		await expect(() => mgr.acquirePHPInstance()).rejects.toThrowError(
			/Requested more concurrent PHP instances/
		);
	});

	it('should not start a second PHP instance until the first getInstance() call when the primary instance is busy', async () => {
		const phpFactory = vitest.fn(
			async () => await NodePHP.load(RecommendedPHPVersion)
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
});
