/**
 * Entry point for testing browser bundle with CommonJS require().
 * This tests that web packages can be required in a CommonJS context
 * and then bundled for the browser.
 */
const { PHP } = require('@php-wasm/universal');
const { loadWebRuntime } = require('@php-wasm/web');

// Simple smoke test that verifies the requires resolved correctly
function smokeTest() {
	if (typeof PHP !== 'function') {
		throw new Error('PHP is not a function');
	}
	if (typeof loadWebRuntime !== 'function') {
		throw new Error('loadWebRuntime is not a function');
	}
	console.log(
		'[web-require] Smoke test passed: PHP and loadWebRuntime are available via require()'
	);
	return true;
}

// Export for use in smoke tests
module.exports = { PHP, loadWebRuntime, smokeTest };

if (typeof window !== 'undefined') {
	Promise.resolve()
		.then(() => smokeTest())
		.then(() => {
			window.smokeTestPassed = true;
			window.testComplete = true;
		})
		.catch((error) => {
			window.testErrors?.push({
				msg: error?.stack || error?.message || error?.toString(),
			});
			window.testComplete = true;
			throw error;
		});
}
