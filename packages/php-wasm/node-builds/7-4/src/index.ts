import type { PHPLoaderModule } from '@php-wasm/universal';
import { jspi } from 'wasm-feature-detect';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Use custom names to avoid conflicts with esbuild's __filename/__dirname polyfills
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);
// The package root is one level up from src/
const packageDir = dirname(currentDirPath);

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
		return join(packageDir, 'jspi/extensions/intl/7_4/intl.so');
	} else {
		return join(packageDir, 'asyncify/extensions/intl/7_4/intl.so');
	}
}

export async function getXdebugExtensionPath(): Promise<string> {
	if (await jspi()) {
		return join(packageDir, 'jspi/extensions/xdebug/7_4/xdebug.so');
	} else {
		return join(packageDir, 'asyncify/extensions/xdebug/7_4/xdebug.so');
	}
}

export { jspi };
