import { basename, dirname } from '@php-wasm/util';

/** Encodes each filename as a URL component without interpreting its bytes as URL syntax. */
export function publicFileUrl(path: string, base: URL): URL {
	const parent = dirname(path);
	const directory = parent ? publicFileUrl(parent, base) : new URL(base);
	if (parent) directory.pathname += '/';
	return new URL(encodeURIComponent(basename(path)), directory);
}
