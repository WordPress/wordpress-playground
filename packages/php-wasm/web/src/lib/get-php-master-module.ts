import type { PHPLoaderModule } from '@php-wasm/universal';
import type { PHPWasmAsyncMode } from './get-php-loader-module';

interface PHPMasterModule {
	getPHPLoaderModule(asyncMode: PHPWasmAsyncMode): Promise<PHPLoaderModule>;
}

export async function getPHPMasterModule(): Promise<PHPMasterModule> {
	const urls = getPHPMasterModuleUrls();
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

function getPHPMasterModuleUrls() {
	const origin = globalThis.location?.origin || '';
	const pathname = globalThis.location?.pathname || '/';
	const basePath = pathname.startsWith('/website-server/')
		? '/website-server/'
		: '/';
	// The website serves assets from `/php-master/` in production, while
	// Vite dev serves them under `/website-server/php-master/`.
	return Array.from(
		new Set([
			`${origin}${basePath}php-master/index.js`,
			`${origin}/website-server/php-master/index.js`,
			`${origin}/php-master/index.js`,
		])
	);
}
