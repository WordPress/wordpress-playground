import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import type { PHPLoaderModule, SupportedPHPVersion } from '@php-wasm/universal';

/**
 * Determines whether to use require() or dynamic import() to load PHP modules.
 */
function getModuleLoadingStrategy(): 'require' | 'import' {
	// Check if we're in Jest environment
	// Jest runs tests in a VM context that doesn't support dynamic import() without
	// the --experimental-vm-modules flag. Jest sets JEST_WORKER_ID when running tests.
	// Error without flag: "A dynamic import callback was invoked without --experimental-vm-modules"
	// See: https://jestjs.io/docs/ecmascript-modules
	if (process.env && process.env['JEST_WORKER_ID']) {
		// Use require() in Jest unless explicitly configured for ESM
		return 'require';
	}

	// Check if require() is even available
	// In pure ESM environments, require won't exist and we must use import()
	if (typeof require !== 'function') {
		return 'import';
	}

	// Check if we're in a CommonJS environment without module/module.exports
	// If module or module.exports is undefined, we're in an ESM-only context
	// where require() won't work anyway
	if (
		typeof module === 'undefined' ||
		typeof module.exports === 'undefined'
	) {
		return 'import';
	}

	// All checks passed - we're in a Node.js environment that supports dynamic import()
	// Modern Node.js (12.20+) supports dynamic import() in both ESM and CommonJS contexts
	// This includes Vitest and other modern test runners
	return 'import';
}

/**
 * Loads the PHP loader module for the given PHP version.
 *
 * Uses dynamic import() by default, falling back to require() in Jest environments
 * where dynamic import isn't supported without --experimental-vm-modules.
 */
export async function getPHPLoaderModule(
	version: SupportedPHPVersion = LatestSupportedPHPVersion
): Promise<PHPLoaderModule> {
	const loadingStrategy = getModuleLoadingStrategy();

	if (loadingStrategy === 'require') {
		// Use require() for environments that don't support dynamic import
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

	// Use dynamic import() - the modern, preferred approach
	// Works in: ESM, Vitest, modern Node.js CJS (12.20+), and with workspace symlinks
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
