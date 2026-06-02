// eslint-disable-next-line @nx/enforce-module-boundaries -- ignore test-related interdependencies so we can test.
import { PHP, PHPRequestHandler, PHPWorker } from '@php-wasm/universal';
import { loadNodeRuntime, type PHPExtension } from '..';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { jspi } from 'wasm-feature-detect';

const isJspiAvailable = await jspi();
const workerLifecycleExtensionNames = [
	'xdebug',
	'intl',
	...(isJspiAvailable ? ['redis', 'memcached'] : []),
];
const workerLifecycleLoaderOptions = {
	extensions: [
		'xdebug',
		'intl',
		...(isJspiAvailable ? (['redis', 'memcached'] as const) : []),
	] satisfies PHPExtension[],
};

describe('PHP Worker', () => {
	let handler: PHPRequestHandler;
	let worker: PHPWorker;
	beforeEach(async () => {
		({ handler, worker } = await createWorker());
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

	it('loads configured extensions in every PHP instance acquired by the worker', async () => {
		await worker[Symbol.asyncDispose]();
		await handler[Symbol.asyncDispose]();
		({ handler, worker } = await createWorker(
			workerLifecycleLoaderOptions
		));

		const acquired = [];
		try {
			acquired.push(await handler.instanceManager.acquirePHPInstance());
			acquired.push(await handler.instanceManager.acquirePHPInstance());

			const heldResults = await Promise.all(
				acquired.map(({ php }) =>
					php.run({
						code: extensionCheckCode(workerLifecycleExtensionNames),
					})
				)
			);

			expect(heldResults.map(({ text }) => text)).toEqual([
				expectedExtensionCheckOutput(workerLifecycleExtensionNames),
				expectedExtensionCheckOutput(workerLifecycleExtensionNames),
			]);

			const workerResult = await worker.run({
				code: extensionCheckCode(workerLifecycleExtensionNames),
			});
			expect(workerResult.text).toBe(
				expectedExtensionCheckOutput(workerLifecycleExtensionNames)
			);
		} finally {
			for (const acquiredPhp of acquired) {
				acquiredPhp.reap();
			}
		}
	});
});

async function createWorker(
	loaderOptions: Parameters<typeof loadNodeRuntime>[1] = {}
) {
	const handler = new PHPRequestHandler({
		documentRoot: '/wordpress',
		absoluteUrl: 'http://127.0.0.1:2398',
		phpFactory: async () =>
			new PHP(
				await loadNodeRuntime(RecommendedPHPVersion, loaderOptions)
			),
		maxPhpInstances: 3,
	});
	const worker = new PHPWorker(handler);
	await worker.setPrimaryPHP(await handler.getPrimaryPhp());
	return { handler, worker };
}

function extensionCheckCode(extensionNames: string[]) {
	return `<?php
		$extensions = ${phpArrayLiteral(extensionNames)};
		foreach ($extensions as $extension) {
			echo $extension . ':' . (extension_loaded($extension) ? 'loaded' : 'missing') . "\\n";
		}
	`;
}

function expectedExtensionCheckOutput(extensionNames: string[]) {
	return extensionNames
		.map((extensionName) => `${extensionName}:loaded\n`)
		.join('');
}

function phpArrayLiteral(values: string[]) {
	return `array(${values
		.map((value) => `'${value.replaceAll("'", "\\'")}'`)
		.join(', ')})`;
}
