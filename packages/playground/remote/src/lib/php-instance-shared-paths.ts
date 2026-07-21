import type { PathAlias } from '@php-wasm/universal';
import { isParentOf, normalizePath } from '@php-wasm/util';

export function getPhpInstanceSharedPaths(
	documentRoot: string,
	pathAliases: PathAlias[] = []
) {
	const standardSharedPaths = [
		'/tmp',
		documentRoot,
		'/internal/shared',
		'/internal/symlinks',
	].map(normalizePath);
	/*
	 * Share each declared alias target itself. `proxyFileSystem()` creates a missing
	 * target before mounting it, so later writes anywhere below `fsPath` go through
	 * to the primary instance. This avoids guessing which ancestor should be shared
	 * and keeps unrelated sibling paths private.
	 */
	const aliasSharedPaths = pathAliases.map(({ fsPath }) =>
		normalizePath(fsPath)
	);
	const candidatePaths = Array.from(
		new Set([...standardSharedPaths, ...aliasSharedPaths])
	);

	return candidatePaths.filter(
		(path) =>
			!candidatePaths.some(
				(candidate) => candidate !== path && isParentOf(candidate, path)
			)
	);
}
