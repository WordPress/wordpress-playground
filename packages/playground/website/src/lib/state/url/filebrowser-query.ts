import { normalizePath, resolvePathUnder } from '@php-wasm/util';

export type FileBrowserQuery = {
	isRequested: boolean;
	path: string | null;
	line: number | null;
	error: string | null;
};

export const FILE_BROWSER_INVALID_PATH_NOTICE =
	'The requested file path is invalid. Use a file path relative to the WordPress document root.';
export const FILE_BROWSER_INVALID_LINE_NOTICE =
	'The requested line number is invalid. Use a 1-based line number.';

/** Parses a document-root-relative file path and optional 1-based line from the URL. */
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
	if (line !== null && (!Number.isSafeInteger(line) || line < 1)) {
		return {
			isRequested: true,
			path: null,
			line: null,
			error: FILE_BROWSER_INVALID_LINE_NOTICE,
		};
	}
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

/** Enables file-browser startup only where the standalone Playground UI is available. */
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

/** Resolves a parsed file path without allowing it to escape the document root. */
export function resolveFileBrowserPath(
	documentRoot: string,
	relativePath: string
) {
	return resolvePathUnder(relativePath, documentRoot) ?? null;
}

function splitLineSuffix(rawValue: string) {
	const lineMatch = rawValue.match(/^(.*):([+-]?\d+)$/);
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
	if (!rawPath || rawPath.startsWith('/') || rawPath.includes('\0')) {
		return null;
	}

	const normalizedPath = normalizePath(rawPath);
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
