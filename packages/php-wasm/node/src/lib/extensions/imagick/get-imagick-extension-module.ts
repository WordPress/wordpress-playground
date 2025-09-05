import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import type { SupportedPHPVersion } from '@php-wasm/universal';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

/**
 * Resolve the on-disk path to the imagick extension module for a given PHP version.
 *
 * This function avoids bundler-specific `?url` imports to keep tests working even
 * when the imagick binaries are not present. The packaging step copies
 * `packages/php-wasm/node/jspi` (and asyncify) into the dist, so direct
 * filesystem paths work in both source and built packages.
 */
export async function getImagickExtensionModule(
	version: SupportedPHPVersion = LatestSupportedPHPVersion
): Promise<string> {
	const versionUnderscored = version.replace('.', '_');
	const __dirname = path.dirname(fileURLToPath(import.meta.url));

	// Try JSPI first, then Asyncify as a fallback
	const jspiPath = path.resolve(
		__dirname,
		'../../../../jspi/extensions/imagick',
		versionUnderscored,
		'imagick.so'
	);
	if (fs.existsSync(jspiPath)) {
		return jspiPath;
	}

	const asyncifyPath = path.resolve(
		__dirname,
		'../../../../asyncify/extensions/imagick',
		versionUnderscored,
		'imagick.so'
	);
	if (fs.existsSync(asyncifyPath)) {
		return asyncifyPath;
	}

	throw new Error(
		`Imagick extension for PHP ${version} not found in JSPI or Asyncify folders.`
	);
}
