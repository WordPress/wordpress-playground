// eslint-disable-next-line @nx/enforce-module-boundaries -- ignore test-related interdependencies so we can test.
import { PHP, PHPRequestHandler, PHPWorker } from '@php-wasm/universal';
import { loadNodeRuntime } from '..';
import { RecommendedPHPVersion } from '@wp-playground/common';

describe('PHP Worker', () => {
	let handler: PHPRequestHandler;
	let worker: PHPWorker;
	beforeEach(async () => {
		handler = new PHPRequestHandler({
			documentRoot: '/wordpress',
			absoluteUrl: 'http://127.0.0.1:2398',
			phpFactory: async () =>
				new PHP(await loadNodeRuntime(RecommendedPHPVersion)),
			maxPhpInstances: 3,
		});
		worker = new PHPWorker(handler);
		await worker.setPrimaryPHP(await handler.getPrimaryPhp());
	});

	afterEach(async () => {
		await handler[Symbol.asyncDispose]();
		await worker[Symbol.asyncDispose]();
	});

	it('chdir() should change cwd for the worker', async () => {
		worker.chdir('/tmp');
		expect(worker.cwd()).toBe('/tmp');
	});

	it('chdir() should change cwd for the PHP instances', async () => {
		worker.chdir('/tmp');

		/**
		 * Block the primary PHP instance to ensure run()
		 * creates a fresh PHP instance.
		 */
		const { reap } = await handler.instanceManager.acquirePHPInstance();
		try {
			const response = await worker.run({
				code: `<?php echo getcwd();`,
			});
			expect(response.text).toBe('/tmp');
		} finally {
			reap();
		}
	});

	it('addEventListener() should add a listener for all PHP instances spawned by the worker', async () => {
		const received: any[] = [];
		worker.addEventListener('request.end', (event) => {
			received.push(event);
		});
		await worker.run({
			code: `<?php echo getcwd();`,
		});
		expect(received).toHaveLength(1);
	});
});
