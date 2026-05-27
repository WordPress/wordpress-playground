import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import type { AllPHPVersion } from '@php-wasm/universal';
import type { PHPWasmAsyncMode } from '../../get-php-loader-module';

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
	version: AllPHPVersion = LatestSupportedPHPVersion,
	asyncMode: PHPWasmAsyncMode = 'asyncify'
): Promise<any> {
	switch (version) {
		case 'master':
			return (await getPhpMasterModule()).getIntlExtensionPath(asyncMode);
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

async function getPhpMasterModule(): Promise<{
	getIntlExtensionPath(asyncMode: PHPWasmAsyncMode): Promise<string>;
}> {
	const urls = getPhpMasterModuleUrls();
	let cause: unknown;
	for (const masterModuleUrl of urls) {
		try {
			return await import(/* @vite-ignore */ masterModuleUrl);
		} catch (error) {
			cause = error;
		}
	}
	throw new Error(
		'PHP master assets are missing. Run `npm run sync:php-master` ' +
			'before using PHP master locally.',
		{ cause }
	);
}

function getPhpMasterModuleUrls() {
	const origin = globalThis.location?.origin || '';
	const pathname = globalThis.location?.pathname || '/';
	const basePath = pathname.startsWith('/website-server/')
		? '/website-server/'
		: '/';
	return Array.from(
		new Set([
			`${origin}${basePath}php-master/index.js`,
			`${origin}/website-server/php-master/index.js`,
			`${origin}/php-master/index.js`,
		])
	);
}
