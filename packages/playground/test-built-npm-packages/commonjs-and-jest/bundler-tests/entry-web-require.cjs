/**
 * Entry point for testing browser bundle with CommonJS require().
 * This tests that web packages can be required in a CommonJS context
 * and then bundled for the browser.
 */
const { PHP } = require('@php-wasm/universal');
const { loadWebRuntime } = require('@php-wasm/web');
const { listGitFiles } = require('@wp-playground/storage');

const expectedStorageGitFetchError = 'expected-storage-git-fetch-stop';

async function verifyStorageGitChunkLoads() {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => {
		throw new Error(expectedStorageGitFetchError);
	};

	try {
		await listGitFiles(
			'https://example.com/repo.git',
			'0000000000000000000000000000000000000000'
		);
	} catch (error) {
		if (
			!(error instanceof Error) ||
			error.message !== expectedStorageGitFetchError
		) {
			throw error;
		}
	} finally {
		globalThis.fetch = originalFetch;
	}
}

// Simple smoke test that verifies the requires resolved correctly
async function smokeTest() {
	if (typeof PHP !== 'function') {
		throw new Error('PHP is not a function');
	}
	if (typeof loadWebRuntime !== 'function') {
		throw new Error('loadWebRuntime is not a function');
	}
	if (typeof listGitFiles !== 'function') {
		throw new Error('listGitFiles is not a function');
	}
	await verifyStorageGitChunkLoads();
	console.log(
		'[web-require] Smoke test passed: PHP, loadWebRuntime, and storage git chunk are available via require()'
	);
	return true;
}

// Export for use in smoke tests
module.exports = { PHP, loadWebRuntime, listGitFiles, smokeTest };

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
