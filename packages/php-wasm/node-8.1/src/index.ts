import type { PHPLoaderModule } from '@php-wasm/universal';
import { jspi } from 'wasm-feature-detect';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function getPHPLoaderModule(): Promise<PHPLoaderModule> {
	if (await jspi()) {
		// @ts-ignore
		return await import('../jspi/php_8_1.js');
	} else {
		// @ts-ignore
		return await import('../asyncify/php_8_1.js');
	}
}

export async function getIntlExtensionPath(): Promise<string> {
	if (await jspi()) {
		return join(__dirname, '../jspi/extensions/intl/8_1/intl.so');
	} else {
		return join(__dirname, '../asyncify/extensions/intl/8_1/intl.so');
	}
}

export async function getXdebugExtensionPath(): Promise<string> {
	if (await jspi()) {
		return join(__dirname, '../jspi/extensions/xdebug/8_1/xdebug.so');
	} else {
		return join(__dirname, '../asyncify/extensions/xdebug/8_1/xdebug.so');
	}
}

export { jspi };
