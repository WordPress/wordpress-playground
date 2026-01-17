import type { PHPLoaderModule, SupportedPHPVersion } from '@php-wasm/universal';
import { LatestSupportedPHPVersion } from '@php-wasm/universal';

/**
 * Loads the PHP loader module for the given PHP version.
 *
 * Each PHP version is packaged separately to reduce bundle size.
 * - @php-wasm/web-8-5
 * - @php-wasm/web-8-4
 * - @php-wasm/web-8-3
 * - etc.
 *
 * @param version The PHP version to load.
 * @returns The PHP loader module.
 */
export async function getPHPLoaderModule(
	version: SupportedPHPVersion = LatestSupportedPHPVersion
): Promise<PHPLoaderModule> {
	switch (version) {
		case '8.5':
			// @ts-ignore
			return (await import('@php-wasm/web-8-5')).getPHPLoaderModule();
		case '8.4':
			// @ts-ignore
			return (await import('@php-wasm/web-8-4')).getPHPLoaderModule();
		case '8.3':
			// @ts-ignore
			return (await import('@php-wasm/web-8-3')).getPHPLoaderModule();
		case '8.2':
			// @ts-ignore
			return (await import('@php-wasm/web-8-2')).getPHPLoaderModule();
		case '8.1':
			// @ts-ignore
			return (await import('@php-wasm/web-8-1')).getPHPLoaderModule();
		case '8.0':
			// @ts-ignore
			return (await import('@php-wasm/web-8-0')).getPHPLoaderModule();
		case '7.4':
			// @ts-ignore
			return (await import('@php-wasm/web-7-4')).getPHPLoaderModule();
	}
	throw new Error(`Unsupported PHP version ${version}`);
}
