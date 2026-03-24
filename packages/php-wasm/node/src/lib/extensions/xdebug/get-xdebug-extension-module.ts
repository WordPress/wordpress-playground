import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import type { SupportedPHPVersion } from '@php-wasm/universal';

/**
 * Returns the path to the xdebug extension for the specified PHP version.
 *
 * Each PHP version's xdebug extension is packaged separately. Install the
 * version-specific package you need:
 * - @php-wasm/node-8-5
 * - @php-wasm/node-8-4
 * - etc.
 */
export async function getXdebugExtensionModule(
	version: SupportedPHPVersion = LatestSupportedPHPVersion
): Promise<any> {
	switch (version) {
		case '8.5':
			// @ts-ignore
			return (
				await import('@php-wasm/node-8-5')
			).getXdebugExtensionPath();
		case '8.4':
			// @ts-ignore
			return (
				await import('@php-wasm/node-8-4')
			).getXdebugExtensionPath();
		case '8.3':
			// @ts-ignore
			return (
				await import('@php-wasm/node-8-3')
			).getXdebugExtensionPath();
		case '8.2':
			// @ts-ignore
			return (
				await import('@php-wasm/node-8-2')
			).getXdebugExtensionPath();
		case '8.1':
			// @ts-ignore
			return (
				await import('@php-wasm/node-8-1')
			).getXdebugExtensionPath();
		case '8.0':
			// @ts-ignore
			return (
				await import('@php-wasm/node-8-0')
			).getXdebugExtensionPath();
		case '7.4':
			// @ts-ignore
			return (
				await import('@php-wasm/node-7-4')
			).getXdebugExtensionPath();
	}
	throw new Error(`Unsupported PHP version ${version}`);
}
