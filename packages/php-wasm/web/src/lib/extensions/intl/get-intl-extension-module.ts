import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import type { SupportedPHPVersion } from '@php-wasm/universal';

/**
 * Returns the path to the intl extension for the specified PHP version.
 *
 * Each PHP version's intl extension is packaged separately. Install the
 * version-specific package you need:
 * - @php-wasm/web-8-5
 * - @php-wasm/web-8-4
 * - etc.
 */
export async function getIntlExtensionModule(
	version: SupportedPHPVersion = LatestSupportedPHPVersion
): Promise<any> {
	switch (version) {
		case '8.5':
			// @ts-ignore
			return (await import('@php-wasm/web-8-5')).getIntlExtensionPath();
		case '8.4':
			// @ts-ignore
			return (await import('@php-wasm/web-8-4')).getIntlExtensionPath();
		case '8.3':
			// @ts-ignore
			return (await import('@php-wasm/web-8-3')).getIntlExtensionPath();
		case '8.2':
			// @ts-ignore
			return (await import('@php-wasm/web-8-2')).getIntlExtensionPath();
		case '8.1':
			// @ts-ignore
			return (await import('@php-wasm/web-8-1')).getIntlExtensionPath();
		case '8.0':
			// @ts-ignore
			return (await import('@php-wasm/web-8-0')).getIntlExtensionPath();
		case '7.4':
			// @ts-ignore
			return (await import('@php-wasm/web-7-4')).getIntlExtensionPath();
	}
	throw new Error(`Unsupported PHP version ${version}`);
}
