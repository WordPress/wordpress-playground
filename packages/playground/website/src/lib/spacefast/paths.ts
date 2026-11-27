import { basename, dirname, joinPaths } from '@php-wasm/util';

export const SOURCE_DIRECTORY = '_playground';

/** Encodes each filename as a URL component without interpreting its bytes as URL syntax. */
export function publicFileUrl(path: string, base: URL): URL {
	const parent = dirname(path);
	const directory = parent ? publicFileUrl(parent, base) : new URL(base);
	if (parent) directory.pathname += '/';
	return new URL(encodeURIComponent(basename(path)), directory);
}

/** Older saved sites kept a separate source copy of uploads. */
export function uploadFilePath(formatVersion: 1 | 2, path: string): string {
	return joinPaths(
		formatVersion === 1
			? joinPaths(SOURCE_DIRECTORY, 'uploads')
			: 'wp-content/uploads',
		path
	);
}
