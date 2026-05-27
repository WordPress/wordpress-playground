import type { PHPLoaderModule, AllPHPVersion } from '@php-wasm/universal';
import { LatestSupportedPHPVersion } from '@php-wasm/universal';

export type PHPWasmAsyncMode = 'jspi' | 'asyncify';

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
	version: AllPHPVersion = LatestSupportedPHPVersion,
	asyncMode: PHPWasmAsyncMode = 'asyncify'
): Promise<PHPLoaderModule> {
	switch (version) {
		case 'nightly':
			return (await getPHPNightlyModule()).getPHPLoaderModule(asyncMode);
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
		case '5.2':
			// @ts-ignore
			return (await import('@php-wasm/web-5-2')).getPHPLoaderModule();
	}
	throw new Error(`Unsupported PHP version ${version}`);
}

async function getPHPNightlyModule(): Promise<{
	getPHPLoaderModule(asyncMode: PHPWasmAsyncMode): Promise<PHPLoaderModule>;
}> {
	const urls = getPHPNightlyModuleUrls();
	let cause: unknown;
	for (const nightlyModuleUrl of urls) {
		try {
			return await import(/* @vite-ignore */ nightlyModuleUrl);
		} catch (error) {
			cause = error;
		}
	}
	throw new Error(
		'PHP nightly assets are missing. Run `npm run sync:php-nightly` ' +
			'before using PHP nightly locally.',
		{ cause }
	);
}

function getPHPNightlyModuleUrls() {
	const origin = globalThis.location?.origin || '';
	const pathname = globalThis.location?.pathname || '/';
	const basePath = pathname.startsWith('/website-server/')
		? '/website-server/'
		: '/';
	return Array.from(
		new Set([
			`${origin}${basePath}php-nightly/index.js`,
			`${origin}/website-server/php-nightly/index.js`,
			`${origin}/php-nightly/index.js`,
		])
	);
}
