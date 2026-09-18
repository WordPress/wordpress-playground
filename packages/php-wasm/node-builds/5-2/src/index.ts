import type { PHPLoaderModule } from '@php-wasm/universal';
import { jspi } from 'wasm-feature-detect';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

// Determine the current directory path. In CJS mode, __dirname is available.
// In ESM mode, we derive it from import.meta.url.
// We use a type assertion to avoid TypeScript errors about __dirname in ESM.
declare const __dirname: string | undefined;
const currentDirPath =
	typeof __dirname !== 'undefined'
		? __dirname
		: dirname(fileURLToPath(import.meta.url));
// In development, the file is in src/ so we need to go up one level.
// In the built package, the file is at the package root.
// Detect by checking if jspi/ exists in the current directory.
// Unused on legacy 5.2 today (no JSPI-gated extensions), but kept so
// future cherry-picks from newer version packages apply cleanly.
const packageRoot = existsSync(join(currentDirPath, 'jspi'))
	? currentDirPath
	: dirname(currentDirPath);
void packageRoot;

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

export async function getXdebugExtensionPath(): Promise<string> {
	throw new Error('The Xdebug extension is not available for PHP 5.2.');
}

export async function getRedisExtensionPath(): Promise<string> {
	throw new Error('The Redis extension is not available for PHP 5.2.');
}

export async function getMemcachedExtensionPath(): Promise<string> {
	throw new Error('The Memcached extension is not available for PHP 5.2.');
}

export { jspi };
