import type { PHPLoaderModule } from '@php-wasm/universal';
import { jspi } from 'wasm-feature-detect';

/**
 * PHP 5.6 is only available as a JSPI build — there is no asyncify
 * variant. Browsers that lack JSPI support cannot run PHP 5.6.
 */
export async function getPHPLoaderModule(): Promise<PHPLoaderModule> {
	if (!(await jspi())) {
		throw new Error(
			'PHP 5.6 requires WebAssembly JSPI support, which is not ' +
				'available in this browser. Please use a Chromium-based ' +
				'browser with JSPI enabled.'
		);
	}
	// @ts-ignore
	return await import('../jspi/php_5_6.js');
}

export { jspi };
