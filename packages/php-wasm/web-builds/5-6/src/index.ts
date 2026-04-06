import type { PHPLoaderModule } from '@php-wasm/universal';
import { jspi } from 'wasm-feature-detect';

export async function getPHPLoaderModule(): Promise<PHPLoaderModule> {
	if (await jspi()) {
		// @ts-ignore
		return await import('../jspi/php_5_6.js');
	} else {
		// @ts-ignore
		return await import('../asyncify/php_5_6.js');
	}
}

export { jspi };
