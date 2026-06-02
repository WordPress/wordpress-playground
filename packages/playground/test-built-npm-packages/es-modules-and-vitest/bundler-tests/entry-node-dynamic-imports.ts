/**
 * Entry point for testing Node.js bundle with dynamic ESM imports.
 * This tests that the packages can be dynamically imported at runtime.
 */

// Simple smoke test that verifies dynamic imports work
export async function smokeTest(): Promise<boolean> {
	const { PHP } = await import('@php-wasm/universal');
	const { loadNodeRuntime } = await import('@php-wasm/node');

	if (typeof PHP !== 'function') {
		throw new Error('PHP is not a function');
	}
	if (typeof loadNodeRuntime !== 'function') {
		throw new Error('loadNodeRuntime is not a function');
	}
	console.log(
		'[node-dynamic-imports] Smoke test passed: PHP and loadNodeRuntime are available via dynamic import'
	);
	return true;
}
