import type { PHPLoaderModule } from '@php-wasm/universal';
import { jspi } from 'wasm-feature-detect';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Use custom names to avoid conflicts with esbuild's __filename/__dirname polyfills
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);

export async function getPHPLoaderModule(): Promise<PHPLoaderModule> {
	if (await jspi()) {
		// @ts-ignore
		return await import('../jspi/php_8_4.js');
	} else {
		// @ts-ignore
		return await import('../asyncify/php_8_4.js');
	}
}

export async function getIntlExtensionPath(): Promise<string> {
	if (await jspi()) {
		return join(currentDirPath, 'jspi/extensions/intl/8_4/intl.so');
	} else {
		return join(currentDirPath, 'asyncify/extensions/intl/8_4/intl.so');
	}
}

export async function getXdebugExtensionPath(): Promise<string> {
	if (await jspi()) {
		return join(currentDirPath, 'jspi/extensions/xdebug/8_4/xdebug.so');
	} else {
		return join(currentDirPath, 'asyncify/extensions/xdebug/8_4/xdebug.so');
	}
}

export { jspi };
