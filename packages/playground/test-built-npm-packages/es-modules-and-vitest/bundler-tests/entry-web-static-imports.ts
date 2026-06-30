/**
 * Entry point for testing browser bundle with static ESM imports.
 * This file imports @php-wasm/web and @php-wasm/universal which are
 * the packages intended for browser use.
 */
import { PHP } from '@php-wasm/universal';
import { loadWebRuntime } from '@php-wasm/web';

// Export for use in smoke tests
export { PHP, loadWebRuntime };

// Simple smoke test that verifies the imports resolved correctly
export function smokeTest(): boolean {
	if (typeof PHP !== 'function') {
		throw new Error('PHP is not a function');
	}
	if (typeof loadWebRuntime !== 'function') {
		throw new Error('loadWebRuntime is not a function');
	}
	console.log(
		'[web-static-imports] Smoke test passed: PHP and loadWebRuntime are available'
	);
	return true;
}

if (typeof window !== 'undefined') {
	Promise.resolve()
		.then(() => smokeTest())
		.then(() => {
			(window as any).smokeTestPassed = true;
			(window as any).testComplete = true;
		})
		.catch((error) => {
			(window as any).testErrors?.push({
				msg: error?.stack || error?.message || error?.toString(),
			});
			(window as any).testComplete = true;
			throw error;
		});
}
