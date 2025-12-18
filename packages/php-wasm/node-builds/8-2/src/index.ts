import type { PHPLoaderModule } from '@php-wasm/universal';
import { jspi } from 'wasm-feature-detect';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

// Use custom names to avoid conflicts with esbuild's __filename/__dirname polyfills
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);
// In development, the file is in src/ so we need to go up one level.
// In the built package, the file is at the package root.
// Detect by checking if jspi/ exists in the current directory.
const packageDir = existsSync(join(currentDirPath, 'jspi'))
	? currentDirPath
	: dirname(currentDirPath);

export async function getPHPLoaderModule(): Promise<PHPLoaderModule> {
	if (await jspi()) {
		// @ts-ignore
		return await import('../jspi/php_8_2.js');
	} else {
		// @ts-ignore
		return await import('../asyncify/php_8_2.js');
	}
}

export async function getIntlExtensionPath(): Promise<string> {
	if (await jspi()) {
		return join(packageDir, 'jspi/extensions/intl/8_2/intl.so');
	} else {
		return join(packageDir, 'asyncify/extensions/intl/8_2/intl.so');
	}
}

export async function getXdebugExtensionPath(): Promise<string> {
	if (await jspi()) {
		return join(packageDir, 'jspi/extensions/xdebug/8_2/xdebug.so');
	} else {
		return join(packageDir, 'asyncify/extensions/xdebug/8_2/xdebug.so');
	}
}

export { jspi };
