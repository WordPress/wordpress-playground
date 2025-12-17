import type { PHPLoaderModule } from '@php-wasm/universal';
import { jspi } from 'wasm-feature-detect';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function getPHPLoaderModule(): Promise<PHPLoaderModule> {
	if (await jspi()) {
		// @ts-ignore
		return await import('../jspi/php_7_4.js');
	} else {
		// @ts-ignore
		return await import('../asyncify/php_7_4.js');
	}
}

export async function getIntlExtensionPath(): Promise<string> {
	if (await jspi()) {
		return join(__dirname, '../jspi/extensions/intl/7_4/intl.so');
	} else {
		return join(__dirname, '../asyncify/extensions/intl/7_4/intl.so');
	}
}

export async function getXdebugExtensionPath(): Promise<string> {
	if (await jspi()) {
		return join(__dirname, '../jspi/extensions/xdebug/7_4/xdebug.so');
	} else {
		return join(__dirname, '../asyncify/extensions/xdebug/7_4/xdebug.so');
	}
}

export { jspi };
