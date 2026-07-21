import type { PathAlias } from '@php-wasm/universal';
import { dirname, isParentOf, normalizePath } from '@php-wasm/util';

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
	const aliasSharedPaths = pathAliases.map(({ fsPath }) => {
		const normalizedPath = normalizePath(fsPath);
		const parentPath = dirname(normalizedPath);

		/**
		 * Alias targets may be installed after a secondary PHP instance starts.
		 * Share the parent so later writes are visible without creating the target
		 * early. Do not broaden the mount over an existing shared root.
		 */
		if (
			parentPath !== '/' &&
			!standardSharedPaths.some((sharedPath) =>
				isParentOf(parentPath, sharedPath)
			)
		) {
			return parentPath;
		}
		return normalizedPath;
	});
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
