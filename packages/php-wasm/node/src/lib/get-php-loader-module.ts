import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import type { PHPLoaderModule, SupportedPHPVersion } from '@php-wasm/universal';

/**
 * Loads the PHP loader module for the given PHP version.
 *
 * Each PHP version is packaged separately to reduce bundle size:
 * - @php-wasm/node-8-5
 * - @php-wasm/node-8-4
 * - @php-wasm/node-8-3
 * - etc.
 *
 * ## Module Loading Strategy
 *
 * Uses a try-catch fallback approach:
 * 1. **Tries `import()` first** - Works in ESM, modern CJS (Node 12.20+), and test
 *    runners like Vitest
 * 2. **Falls back to `require()`** - Only if import() fails (rare in modern
 *    environments)
 *
 * ### Why This Approach?
 *
 * **Development**: In monorepo development, workspace symlinks point to source directories
 * without built files. Modern test runners (like Vitest) provide both `module` and `require`
 * but should use `import()` to work with these symlinks. The try-catch approach correctly
 * uses `import()` in these environments.
 *
 * **Production**: Published packages have built files in the correct locations, so both
 * `import()` (ESM consumers) and `require()` (old CJS consumers) work correctly.
 *
 * This avoids environment-specific detection hacks and is future-proof as environments evolve.
 *
 * @param version The PHP version to load.
 * @returns The PHP loader module.
 */
export async function getPHPLoaderModule(
	version: SupportedPHPVersion = LatestSupportedPHPVersion
): Promise<PHPLoaderModule> {
	// Try dynamic import() first - the modern, preferred approach
	// Works in: ESM, Vitest, modern Node.js CJS (12.20+), and with workspace symlinks
	try {
		switch (version) {
			case '8.5':
				// @ts-ignore
				return (
					await import('@php-wasm/node-8-5')
				).getPHPLoaderModule();
			case '8.4':
				// @ts-ignore
				return (
					await import('@php-wasm/node-8-4')
				).getPHPLoaderModule();
			case '8.3':
				// @ts-ignore
				return (
					await import('@php-wasm/node-8-3')
				).getPHPLoaderModule();
			case '8.2':
				// @ts-ignore
				return (
					await import('@php-wasm/node-8-2')
				).getPHPLoaderModule();
			case '8.1':
				// @ts-ignore
				return (
					await import('@php-wasm/node-8-1')
				).getPHPLoaderModule();
			case '8.0':
				// @ts-ignore
				return (
					await import('@php-wasm/node-8-0')
				).getPHPLoaderModule();
			case '7.4':
				// @ts-ignore
				return (
					await import('@php-wasm/node-7-4')
				).getPHPLoaderModule();
			case '7.3':
				// @ts-ignore
				return (
					await import('@php-wasm/node-7-3')
				).getPHPLoaderModule();
			case '7.2':
				// @ts-ignore
				return (
					await import('@php-wasm/node-7-2')
				).getPHPLoaderModule();
		}
		throw new Error(`Unsupported PHP version ${version}`);
	} catch (error) {
		// Fallback: Use require() only if import() failed
		// This handles extremely rare cases: old Node.js versions or restricted environments
		// where dynamic import() is not available
		if (
			typeof module !== 'undefined' &&
			typeof module.exports !== 'undefined' &&
			typeof require === 'function'
		) {
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
			}
		}
		// Re-throw the original error if require() also isn't available
		throw error;
	}
}
