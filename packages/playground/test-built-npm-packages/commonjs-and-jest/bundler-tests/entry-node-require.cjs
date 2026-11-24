/**
 * Entry point for testing Node.js bundle with CommonJS require().
 * This tests that the packages can be required in a CommonJS context.
 */
const { PHP } = require('@php-wasm/universal');
const { loadNodeRuntime } = require('@php-wasm/node');

// Simple smoke test that verifies the requires resolved correctly
function smokeTest() {
	if (typeof PHP !== 'function') {
		throw new Error('PHP is not a function');
	}
	if (typeof loadNodeRuntime !== 'function') {
		throw new Error('loadNodeRuntime is not a function');
	}
	console.log(
		'[node-require] Smoke test passed: PHP and loadNodeRuntime are available via require()'
	);
	return true;
}

// Export for use in smoke tests
module.exports = { PHP, loadNodeRuntime, smokeTest };
