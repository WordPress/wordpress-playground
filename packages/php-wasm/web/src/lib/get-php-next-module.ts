import type { PHPLoaderModule } from '@php-wasm/universal';
import type { PHPWasmAsyncMode } from './get-php-loader-module';

interface PHPNextModule {
	getPHPLoaderModule(asyncMode: PHPWasmAsyncMode): Promise<PHPLoaderModule>;
}

export async function getPHPNextModule(): Promise<PHPNextModule> {
	const urls = getPHPNextModuleUrls();
	let cause: unknown;
	for (const nextModuleUrl of urls) {
		try {
			return await import(/* @vite-ignore */ nextModuleUrl);
		} catch (error) {
			cause = error;
		}
	}
	throw new Error(
		'PHP next assets are missing. Run `npm run sync:php-next` ' +
			'before using PHP next locally.',
		{ cause }
	);
}

function getPHPNextModuleUrls() {
	const origin = globalThis.location?.origin || '';
	const pathname = globalThis.location?.pathname || '/';
	const basePath = pathname.startsWith('/website-server/')
		? '/website-server/'
		: '/';
	// The website serves assets from `/php-next/` in production, while
	// Vite dev serves them under `/website-server/php-next/`.
	return Array.from(
		new Set([
			`${origin}${basePath}php-next/index.js`,
			`${origin}/website-server/php-next/index.js`,
			`${origin}/php-next/index.js`,
		])
	);
}
