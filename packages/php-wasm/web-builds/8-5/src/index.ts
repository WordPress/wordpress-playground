import type { PHPLoaderModule } from '@php-wasm/universal';
import { jspi } from 'wasm-feature-detect';

export async function getPHPLoaderModule(): Promise<PHPLoaderModule> {
	if (await jspi()) {
		// @ts-ignore
		return await import('../jspi/php_8_5.js');
	} else {
		// @ts-ignore
		return await import('../asyncify/php_8_5.js');
	}
}

export async function getIntlExtensionPath(): Promise<string> {
	if (await jspi()) {
		// @ts-ignore
		return (await import('../jspi/extensions/intl/intl.so?url')).default;
	} else {
		// @ts-ignore
		return (await import('../asyncify/extensions/intl/intl.so?url'))
			.default;
	}
}

export { jspi };
