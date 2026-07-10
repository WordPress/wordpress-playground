import {
	isParentOf,
	joinPaths,
	normalizePath,
	toPosixPath,
} from '@php-wasm/util';

export type FileBrowserQuery = {
	isRequested: boolean;
	path: string | null;
	line: number | null;
	error: string | null;
};

export const FILE_BROWSER_INVALID_PATH_NOTICE =
	'The requested file path is invalid. Use a file path relative to the WordPress document root.';

export function parseFileBrowserQuery(
	searchParams: URLSearchParams
): FileBrowserQuery {
	if (!searchParams.has('filebrowser')) {
		return {
			isRequested: false,
			path: null,
			line: null,
			error: null,
		};
	}

	const rawValue = searchParams.get('filebrowser') ?? '';
	if (rawValue === '') {
		return {
			isRequested: true,
			path: null,
			line: null,
			error: null,
		};
	}

	const { path, line } = splitLineSuffix(rawValue);
	const normalizedPath = normalizeRelativeFileBrowserPath(path);
	if (!normalizedPath) {
		return {
			isRequested: true,
			path: null,
			line: null,
			error: FILE_BROWSER_INVALID_PATH_NOTICE,
		};
	}

	return {
		isRequested: true,
		path: normalizedPath,
		line,
		error: null,
	};
}

export function shouldUseFileBrowserQuery(
	searchParams: URLSearchParams,
	isEmbeddedInIframe: boolean
) {
	return (
		searchParams.has('filebrowser') &&
		searchParams.get('mode') !== 'seamless' &&
		!isEmbeddedInIframe
	);
}

export function resolveFileBrowserPath(
	documentRoot: string,
	relativePath: string
) {
	const root = normalizePath(documentRoot);
	const resolvedPath = joinPaths(root, relativePath);
	if (!isParentOf(root, resolvedPath)) {
		return null;
	}
	return resolvedPath;
}

function splitLineSuffix(rawValue: string) {
	const lineMatch = rawValue.match(/^(.*):([1-9]\d*)$/);
	if (!lineMatch) {
		return {
			path: rawValue,
			line: null,
		};
	}
	return {
		path: lineMatch[1],
		line: Number(lineMatch[2]),
	};
}

function normalizeRelativeFileBrowserPath(rawPath: string) {
	const posixPath = toPosixPath(rawPath.trim());
	if (!posixPath || posixPath.startsWith('/')) {
		return null;
	}

	const normalizedPath = normalizePath(posixPath);
	if (
		!normalizedPath ||
		normalizedPath === '.' ||
		normalizedPath === '..' ||
		normalizedPath.startsWith('../')
	) {
		return null;
	}

	return normalizedPath;
}
