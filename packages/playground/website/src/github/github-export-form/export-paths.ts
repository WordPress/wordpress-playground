import { isParentOf, joinPaths, normalizePath } from '@php-wasm/util';

export function normalizePlaygroundPath(path: string) {
	if (path.includes('\0')) {
		return undefined;
	}
	const normalized = normalizePath(path.trim().replace(/\\/g, '/'));
	if (
		!normalized ||
		normalized === '.' ||
		normalized === '..' ||
		normalized.startsWith('../')
	) {
		return undefined;
	}
	return normalized.startsWith('/') ? normalized : joinPaths('/', normalized);
}

export function normalizeRepositoryPath(path: string) {
	if (path.includes('\0')) {
		return undefined;
	}
	const normalized = normalizePath(
		path.trim().replace(/\\/g, '/').replace(/^\/+/g, '')
	);
	if (!normalized || normalized === '.') {
		return '.';
	}
	if (normalized === '..' || normalized.startsWith('../')) {
		return undefined;
	}
	return normalized;
}

export function joinRepositoryPath(root: string, path: string) {
	const normalizedRoot = normalizeRepositoryPath(root);
	const normalizedPath = normalizeRepositoryPath(path);
	if (!normalizedRoot || !normalizedPath) {
		return undefined;
	}
	if (normalizedPath === '.') {
		return normalizedRoot;
	}
	if (normalizedRoot === '.') {
		return normalizedPath;
	}
	return normalizeRepositoryPath(`${normalizedRoot}/${normalizedPath}`);
}

export function resolvePathInsideRoot(root: string, path: string) {
	const normalizedRoot = normalizePlaygroundPath(root);
	if (!normalizedRoot || path.includes('\0')) {
		return undefined;
	}
	const normalizedPath = normalizePath(
		joinPaths(normalizedRoot, path.replace(/\\/g, '/').replace(/^\/+/g, ''))
	);
	if (
		normalizedPath === normalizedRoot ||
		isParentOf(normalizedRoot, normalizedPath)
	) {
		return normalizedPath;
	}
	return undefined;
}

export function relativePathFromRoot(root: string, path: string) {
	const normalizedRoot = normalizePlaygroundPath(root);
	const normalizedPath = normalizePlaygroundPath(path);
	if (!normalizedRoot || !normalizedPath) {
		throw new Error(`Exported path ${path} is outside ${root}.`);
	}
	if (
		normalizedPath !== normalizedRoot &&
		!isParentOf(normalizedRoot, normalizedPath)
	) {
		throw new Error(
			`Exported path ${normalizedPath} is outside ${normalizedRoot}.`
		);
	}
	return normalizedPath.substring(normalizedRoot.length).replace(/^\/+/g, '');
}

export type RepositoryPathScope = {
	path: string;
	recursive: boolean;
};

export function isRepositoryPathInsideScope(
	path: string,
	scope: RepositoryPathScope
) {
	const normalizedPath = normalizeRepositoryPath(path);
	const normalizedScope = normalizeRepositoryPath(scope.path);
	if (!normalizedPath || !normalizedScope) {
		return false;
	}
	if (normalizedPath === normalizedScope) {
		return true;
	}
	if (normalizedScope === '.') {
		return scope.recursive;
	}
	return scope.recursive && normalizedPath.startsWith(`${normalizedScope}/`);
}

export function filterRepositoryFilesToScopes<T>(
	files: Record<string, T>,
	scopes: RepositoryPathScope[]
) {
	if (scopes.length === 0) {
		return files;
	}
	return Object.fromEntries(
		Object.entries(files).filter(([path]) =>
			scopes.some((scope) => isRepositoryPathInsideScope(path, scope))
		)
	);
}
