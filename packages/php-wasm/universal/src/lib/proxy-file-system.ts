import { BasePHP } from './base-php';

/**
 * Proxy specific paths to the parent's MEMFS instance.
 * This is useful for sharing the WordPress installation
 * between the parent and child processes.
 */
export function proxyFileSystem(
	sourceOfTruth: BasePHP,
	replica: BasePHP,
	paths: string[]
) {
	// We can't just import the symbol from the library because
	// Playground CLI is built as ESM and php-wasm-node is built as
	// CJS and the imported symbols will different in the production build.
	const __private__symbol = Object.getOwnPropertySymbols(sourceOfTruth)[0];
	for (const path of paths) {
		if (!replica.fileExists(path)) {
			replica.mkdir(path);
		}
		if (!sourceOfTruth.fileExists(path)) {
			sourceOfTruth.mkdir(path);
		}
		// @ts-ignore
		replica[__private__symbol].FS.mount(
			// @ts-ignore
			replica[__private__symbol].PROXYFS,
			{
				root: path,
				// @ts-ignore
				fs: sourceOfTruth[__private__symbol].FS,
			},
			path
		);
	}
}
