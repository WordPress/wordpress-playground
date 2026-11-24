import type { PHPLoaderModule } from '@php-wasm/universal';
import { jspi } from 'wasm-feature-detect';

export async function getPHPLoaderModule(): Promise<PHPLoaderModule> {
	if (await jspi()) {
		// @ts-ignore
		return await import('../jspi/php_5_2.js');
	} else {
		// @ts-ignore
		return await import('../asyncify/php_5_2.js');
	}
}

export async function getIntlExtensionPath(): Promise<string> {
	throw new Error('The intl extension is not available for PHP 5.2.');
}

export { jspi };
