/**
 * Entry point for testing Node.js bundle with dynamic import() in CommonJS.
 * This tests that the packages can be dynamically imported in a CommonJS context.
 */

// Simple smoke test that verifies dynamic imports work in CJS
async function smokeTest() {
	const { PHP } = await import('@php-wasm/universal');
	const { loadNodeRuntime } = await import('@php-wasm/node');

	if (typeof PHP !== 'function') {
		throw new Error('PHP is not a function');
	}
	if (typeof loadNodeRuntime !== 'function') {
		throw new Error('loadNodeRuntime is not a function');
	}
	console.log(
		'[node-dynamic-import-cjs] Smoke test passed: PHP and loadNodeRuntime are available via dynamic import()'
	);
	return true;
}

// Export for external use
module.exports = { smokeTest };
