/**
 * Entry point for testing browser bundle with static ESM imports.
 * This file imports @php-wasm/web and @php-wasm/universal which are
 * the packages intended for browser use.
 */
import { PHP } from '@php-wasm/universal';
import { loadWebRuntime } from '@php-wasm/web';
import { listGitFiles } from '@wp-playground/storage';

// Export for use in smoke tests
export { PHP, loadWebRuntime, listGitFiles };

const expectedStorageGitFetchError = 'expected-storage-git-fetch-stop';

async function verifyStorageGitChunkLoads(): Promise<void> {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = (async () => {
		throw new Error(expectedStorageGitFetchError);
	}) as typeof fetch;

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

// Simple smoke test that verifies the imports resolved correctly
export async function smokeTest(): Promise<boolean> {
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
		'[web-static-imports] Smoke test passed: PHP, loadWebRuntime, and storage git chunk are available'
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
