import type { PHP } from './php';

/**
 * Proxy specific paths to the parent's MEMFS instance.
 * This is useful for sharing the WordPress installation
 * between the parent and child processes.
 */
export function proxyFileSystem(
	sourceOfTruth: PHP,
	replica: PHP,
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

/**
 * Answers whether the given path is to a shared filesystem.
 *
 * @param sourceOfTruth - The PHP instance that is the source of truth.
 * @param path - The path to check.
 * @returns True if the path is to a shared filesystem, false otherwise.
 */
export function isPathToSharedFS(sourceOfTruth: PHP, path: string) {
	// We can't just import the symbol from the library because
	// Playground CLI is built as ESM and php-wasm-node is built as
	// CJS and the imported symbols will different in the production build.
	const __private__symbol = Object.getOwnPropertySymbols(sourceOfTruth)[0];

	// @ts-ignore
	const FS = sourceOfTruth[__private__symbol].FS;

	const fsResult = FS.lookupPath(path, { noent_okay: true });
	return fsResult?.node?.isSharedFS ?? false;
}
