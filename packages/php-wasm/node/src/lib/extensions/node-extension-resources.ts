import type { PHPExtensionSource } from '@php-wasm/universal';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/**
 * Converts extension sources accepted by the Node runtime into URL-shaped
 * resources before the universal resolver sees them.
 *
 * The universal resolver deals in URLs because browsers can only fetch
 * extension bytes from URLs. Node callers often pass local paths instead, so
 * this function rewrites direct artifact URLs, manifest URLs, and inline
 * manifest base URLs into `URL` objects while leaving byte sources unchanged.
 */
export function normalizeNodeExtensionSource(
	source: PHPExtensionSource
): PHPExtensionSource {
	if (source.format === 'url') {
		return {
			...source,
			url: toNodeResourceUrl(source.url),
		};
	}

	if (source.format !== 'manifest') {
		return source;
	}

	if ('manifest' in source) {
		return source.baseUrl
			? {
					...source,
					baseUrl: toNodeResourceUrl(source.baseUrl),
				}
			: source;
	}

	return {
		...source,
		manifestUrl: toNodeResourceUrl(source.manifestUrl),
	};
}

/**
 * Fetch implementation used by Node extension loading.
 *
 * It behaves like global `fetch()` for HTTP(S) resources and adds `file:`
 * support for local manifests and artifacts. This lets callers use the same
 * extension API for packages installed on disk and for artifacts hosted
 * remotely.
 */
export async function fetchNodeExtensionResource(
	input: RequestInfo | URL
): Promise<Response> {
	const url =
		input instanceof Request
			? new URL(input.url)
			: input instanceof URL
				? input
				: toNodeResourceUrl(String(input));
	if (url.protocol === 'file:') {
		try {
			return new Response(await readFile(fileURLToPath(url)));
		} catch (error) {
			return new Response(String(error), {
				status: 404,
				statusText: 'Not Found',
			});
		}
	}
	return fetch(input);
}

/**
 * Treats syntactically valid URL strings as URLs and every other string as a
 * local filesystem path relative to the current working directory.
 *
 * This deliberately avoids guessing which path shapes are valid on which host
 * OS. If `new URL(value)` accepts the string, it is a URL. If parsing throws,
 * Node resolves it as a path and turns it into a `file:` URL.
 */
function toNodeResourceUrl(urlOrPath: string | URL): URL {
	if (urlOrPath instanceof URL) {
		return urlOrPath;
	}

	try {
		return new URL(urlOrPath);
	} catch {
		return pathToFileURL(path.resolve(urlOrPath));
	}
}
