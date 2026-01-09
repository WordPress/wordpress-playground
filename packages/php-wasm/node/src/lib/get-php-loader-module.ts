import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import type { PHPLoaderModule, SupportedPHPVersion } from '@php-wasm/universal';

/**
 * Loads the PHP loader module for the given PHP version.
 *
 * Uses dynamic import() by default (works in ESM, modern CommonJS, and Vitest).
 * Only uses require() in Jest environments where dynamic import() isn't supported
 * without --experimental-vm-modules.
 */
export async function getPHPLoaderModule(
	version: SupportedPHPVersion = LatestSupportedPHPVersion
): Promise<PHPLoaderModule> {
	// Detect Jest environment and use require() instead of dynamic import()
	// Jest runs tests in a VM context that doesn't support dynamic import() without
	// the --experimental-vm-modules flag. Jest sets JEST_WORKER_ID when running tests.
	// For all other environments (ESM, modern CommonJS, Vitest), dynamic import() works fine.
	// See: https://jestjs.io/docs/ecmascript-modules
	const isJest =
		typeof process !== 'undefined' &&
		process.env &&
		process.env['JEST_WORKER_ID'];

	if (isJest) {
		// Use require() for Jest
		switch (version) {
			case '8.5':
				// @ts-ignore
				return require('@php-wasm/node-8-5').getPHPLoaderModule();
			case '8.4':
				// @ts-ignore
				return require('@php-wasm/node-8-4').getPHPLoaderModule();
			case '8.3':
				// @ts-ignore
				return require('@php-wasm/node-8-3').getPHPLoaderModule();
			case '8.2':
				// @ts-ignore
				return require('@php-wasm/node-8-2').getPHPLoaderModule();
			case '8.1':
				// @ts-ignore
				return require('@php-wasm/node-8-1').getPHPLoaderModule();
			case '8.0':
				// @ts-ignore
				return require('@php-wasm/node-8-0').getPHPLoaderModule();
			case '7.4':
				// @ts-ignore
				return require('@php-wasm/node-7-4').getPHPLoaderModule();
			case '7.3':
				// @ts-ignore
				return require('@php-wasm/node-7-3').getPHPLoaderModule();
			case '7.2':
				// @ts-ignore
				return require('@php-wasm/node-7-2').getPHPLoaderModule();
			default:
				throw new Error(`Unsupported PHP version ${version}`);
		}
	}

	// Use dynamic import() for all other environments
	// Works in: ESM, modern CommonJS (Node.js 12.20+), Vitest, and other modern test runners
	switch (version) {
		case '8.5':
			// @ts-ignore
			return (await import('@php-wasm/node-8-5')).getPHPLoaderModule();
		case '8.4':
			// @ts-ignore
			return (await import('@php-wasm/node-8-4')).getPHPLoaderModule();
		case '8.3':
			// @ts-ignore
			return (await import('@php-wasm/node-8-3')).getPHPLoaderModule();
		case '8.2':
			// @ts-ignore
			return (await import('@php-wasm/node-8-2')).getPHPLoaderModule();
		case '8.1':
			// @ts-ignore
			return (await import('@php-wasm/node-8-1')).getPHPLoaderModule();
		case '8.0':
			// @ts-ignore
			return (await import('@php-wasm/node-8-0')).getPHPLoaderModule();
		case '7.4':
			// @ts-ignore
			return (await import('@php-wasm/node-7-4')).getPHPLoaderModule();
		case '7.3':
			// @ts-ignore
			return (await import('@php-wasm/node-7-3')).getPHPLoaderModule();
		case '7.2':
			// @ts-ignore
			return (await import('@php-wasm/node-7-2')).getPHPLoaderModule();
		default:
			throw new Error(`Unsupported PHP version ${version}`);
	}
}
