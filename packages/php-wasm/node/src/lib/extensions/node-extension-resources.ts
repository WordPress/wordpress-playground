import type { PHPExtensionSource } from '@php-wasm/universal';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

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

export async function fetchNodeExtensionResource(
	input: RequestInfo | URL
): Promise<Response> {
	const url =
		input instanceof Request ? new URL(input.url) : toNodeFetchUrl(input);
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

function toNodeResourceUrl(urlOrPath: string | URL): URL {
	if (urlOrPath instanceof URL) {
		return urlOrPath;
	}

	if (isUrlLike(urlOrPath) && !isWindowsPath(urlOrPath)) {
		return new URL(urlOrPath);
	}

	return pathToFileURL(path.resolve(urlOrPath));
}

function toNodeFetchUrl(input: RequestInfo | URL): URL {
	if (input instanceof URL) {
		return input;
	}
	return toNodeResourceUrl(String(input));
}

function isUrlLike(value: string): boolean {
	return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}

function isWindowsPath(value: string): boolean {
	return /^[a-zA-Z]:[\\/]/.test(value);
}
