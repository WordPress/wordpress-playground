import test from '@playwright/test';
// Importing SupportedPHPVersions from '@php-wasm/universal' causes
// tests to crash in Node due to a 'mime-type.json' import error
// eslint-disable-next-line @nx/enforce-module-boundaries
import { LatestSupportedPHPVersion } from '../../../universal/src/lib/supported-php-versions';

/**
 * This test verifies that PHP instances can be garbage-collected after exit().
 *
 * Without the setImmediate polyfill in loadWebRuntime, Emscripten installs its
 * own message-based polyfill that retains references to the Wasm HEAP buffer,
 * preventing PHP instances from being garbage-collected.
 *
 * @see https://github.com/emscripten-core/emscripten/blob/6d61ffd7076309cb08af37aba496f25c23cdb5a4/src/lib/libeventloop.js#L57
 */
test.describe(`Memory Deallocation - PHP ${LatestSupportedPHPVersion}`, () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', (log) => console.log(log.text()));

		await page.goto('/');

		await page.addScriptTag({
			type: 'module',
			url: '/src/test/playwright/browser-globals.ts',
		});
	});

	/**
	 * Verifies that PHP instances are garbage-collected after exit().
	 *
	 * The test creates multiple PHP instances, registers them with WeakRefs,
	 * exits them, and then triggers garbage collection. If the setImmediate
	 * polyfill is working correctly, the WeakRefs should be cleared.
	 *
	 * We use Chrome DevTools Protocol to force garbage collection since
	 * browsers don't expose gc() directly.
	 */
	test('PHP instances are garbage-collected after exit()', async ({
		page,
	}) => {
		const client = await page.context().newCDPSession(page);

		const result = await page.evaluate(async (phpVersion) => {
			const instances = 5;
			const weakRefs: WeakRef<any>[] = [];

			// Create PHP instances, run code, exit, and register WeakRefs
			for (let i = 0; i < instances; i++) {
				const php = new window.PHP(
					await window.loadWebRuntime(phpVersion as any)
				);

				await php.run({ code: `<?php echo 2 + 2;` });
				php.exit();

				// Register WeakRef after exit to track GC
				weakRefs.push(new WeakRef(php));
			}

			// Store WeakRefs on window for later inspection
			(window as any).__testWeakRefs = weakRefs;

			return instances;
		}, LatestSupportedPHPVersion);

		test.expect(result).toBe(5);

		// Force garbage collection via Chrome DevTools Protocol
		await client.send('HeapProfiler.collectGarbage');

		// Give the GC time to run and finalization callbacks to execute
		await page.waitForTimeout(500);

		// Force another GC pass
		await client.send('HeapProfiler.collectGarbage');
		await page.waitForTimeout(100);

		// Check how many WeakRefs have been cleared
		const { clearedCount, totalCount } = await page.evaluate(() => {
			const refs = (window as any).__testWeakRefs as WeakRef<any>[];
			let cleared = 0;
			for (const ref of refs) {
				if (ref.deref() === undefined) {
					cleared++;
				}
			}
			return { clearedCount: cleared, totalCount: refs.length };
		});

		// At least some instances should be garbage-collected
		// We expect most or all to be collected, but GC timing is non-deterministic
		test.expect(clearedCount).toBeGreaterThanOrEqual(1);
		console.log(`GC cleared ${clearedCount}/${totalCount} PHP instances`);
	});
});
