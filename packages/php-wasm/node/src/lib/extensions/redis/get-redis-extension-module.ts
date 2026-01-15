import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import type { SupportedPHPVersion } from '@php-wasm/universal';

/**
 * Returns the path to the redis extension for the specified PHP version.
 *
 * Each PHP version's redis extension is packaged separately. Install the
 * version-specific package you need:
 * - @php-wasm/node-8-5
 * - @php-wasm/node-8-4
 * - etc.
 */
export async function getRedisExtensionModule(
	version: SupportedPHPVersion = LatestSupportedPHPVersion
): Promise<any> {
	switch (version) {
		case '8.5':
			// PHP 8.5 has internal API changes that phpredis 6.3.0 doesn't support yet.
			// The zend_throw_exception signature changed, causing WebAssembly LinkError.
			throw new Error(
				'Redis extension is not yet supported for PHP 8.5. ' +
					'phpredis needs to be updated for PHP 8.5 internal API changes.'
			);
		case '8.4':
			// @ts-ignore
			return (await import('@php-wasm/node-8-4')).getRedisExtensionPath();
		case '8.3':
			// @ts-ignore
			return (await import('@php-wasm/node-8-3')).getRedisExtensionPath();
		case '8.2':
			// @ts-ignore
			return (await import('@php-wasm/node-8-2')).getRedisExtensionPath();
		case '8.1':
			// @ts-ignore
			return (await import('@php-wasm/node-8-1')).getRedisExtensionPath();
		case '8.0':
			// @ts-ignore
			return (await import('@php-wasm/node-8-0')).getRedisExtensionPath();
		case '7.4':
			// @ts-ignore
			return (await import('@php-wasm/node-7-4')).getRedisExtensionPath();
	}
	throw new Error(`Unsupported PHP version ${version}`);
}
