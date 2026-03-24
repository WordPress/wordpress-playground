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
		return join(packageDir, 'jspi/extensions/intl/intl.so');
	} else {
		return join(packageDir, 'asyncify/extensions/intl/intl.so');
	}
}

export async function getXdebugExtensionPath(): Promise<string> {
	if (await jspi()) {
		return join(packageDir, 'jspi/extensions/xdebug/xdebug.so');
	} else {
		return join(packageDir, 'asyncify/extensions/xdebug/xdebug.so');
	}
}

export async function getRedisExtensionPath(): Promise<string> {
	if (await jspi()) {
		return join(packageDir, 'jspi/extensions/redis/redis.so');
	}
	throw new Error(
		'The Redis extension requires JSPI (JavaScript Promise Integration) support. ' +
			'Your current environment is using asyncify, which cannot properly handle ' +
			'exceptions during Redis network operations. Please use Node.js 23+ or a ' +
			'browser with JSPI support to use the Redis extension.'
	);
}

export async function getMemcachedExtensionPath(): Promise<string> {
	if (await jspi()) {
		return join(packageDir, 'jspi/extensions/memcached/memcached.so');
	}
	throw new Error(
		'The Memcached extension requires JSPI (JavaScript Promise Integration) support. ' +
			'Your current environment is using asyncify, which cannot properly handle ' +
			'exceptions during Memcached network operations. Please use Node.js 23+ or a ' +
			'browser with JSPI support to use the Memcached extension.'
	);
}

export { jspi };
