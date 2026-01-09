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
	// Detect Jest environment and use require() to avoid dynamic import() issues
	// For all other environments (ESM, modern CommonJS, Vitest), use dynamic import()
	// which works in Node.js 12.20+ regardless of whether the code is running in ESM or CJS.
	// Jest runs tests in a VM context that doesn't support dynamic import() without
	// the --experimental-vm-modules flag. Jest sets JEST_WORKER_ID when running tests.
	// Error without flag: "A dynamic import callback was invoked without --experimental-vm-modules"
	// See: https://jestjs.io/docs/ecmascript-modules
	const shouldUseRequire = process.env && process.env['JEST_WORKER_ID'];

	if (shouldUseRequire) {
		// Use require() specifically for Jest
		if (await jspi()) {
			// @ts-ignore
			return require('../jspi/php_8_0.js');
		} else {
			// @ts-ignore
			return require('../asyncify/php_8_0.js');
		}
	} else {
		// Use dynamic import() for all other environments
		if (await jspi()) {
			// @ts-ignore
			return await import('../jspi/php_8_0.js');
		} else {
			// @ts-ignore
			return await import('../asyncify/php_8_0.js');
		}
	}
}

export async function getIntlExtensionPath(): Promise<string> {
	if (await jspi()) {
		return join(packageDir, 'jspi/extensions/intl/8_0/intl.so');
	} else {
		return join(packageDir, 'asyncify/extensions/intl/8_0/intl.so');
	}
}

export async function getXdebugExtensionPath(): Promise<string> {
	if (await jspi()) {
		return join(packageDir, 'jspi/extensions/xdebug/8_0/xdebug.so');
	} else {
		return join(packageDir, 'asyncify/extensions/xdebug/8_0/xdebug.so');
	}
}

export { jspi };
