/**
 * Entry point for testing Node.js bundle with static ESM imports.
 * This file imports @php-wasm/node and @php-wasm/universal which are
 * the packages intended for Node.js use.
 */
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

// Export for use in smoke tests
export { PHP, loadNodeRuntime };

// Simple smoke test that verifies the imports resolved correctly
export function smokeTest(): boolean {
	if (typeof PHP !== 'function') {
		throw new Error('PHP is not a function');
	}
	if (typeof loadNodeRuntime !== 'function') {
		throw new Error('loadNodeRuntime is not a function');
	}
	console.log(
		'[node-static-imports] Smoke test passed: PHP and loadNodeRuntime are available'
	);
	return true;
}
