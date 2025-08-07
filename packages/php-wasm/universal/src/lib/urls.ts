/**
 * The default base used to convert a path into the URL object.
 */
export const DEFAULT_BASE_URL = 'http://example.com';

/**
 * Returns a string representing the path, query, and
 * fragment of the given URL.
 *
 * @example
 * ```js
 * const url = new URL('http://example.com/foo/bar?baz=qux#quux');
 * toRelativeUrl(url); // '/foo/bar?baz=qux#quux'
 * ```
 *
 * @param  url The URL.
 * @returns The path, query, and fragment.
 */
export function toRelativeUrl(url: URL): string {
	/**
	 * The origin of an about:blank URL is a string "null". The URL is not
	 * relative, but there's also nothing we can do to make it "more relative"
	 * so let's just bale out and return the URL as is.
	 *
	 * @see https://html.spec.whatwg.org/multipage/browsers.html#concept-origin (Opaque origins)
	 */
	if (url.origin === 'null') {
		return url.toString();
	}
	return url.toString().substring(url.origin.length);
}

/**
 * Removes the given prefix from the given path.
 *
 * @example
 * ```js
 * removePathPrefix('/foo/bar', '/foo'); // '/bar'
 * removePathPrefix('/bar', '/foo'); // '/bar'
 * ```
 *
 * @param  path   The path to remove the prefix from.
 * @param  prefix The prefix to remove.
 * @returns Path with the prefix removed.
 */
export function removePathPrefix(path: string, prefix: string): string {
	if (!prefix || !path.startsWith(prefix)) {
		return path;
	}
	return path.substring(prefix.length);
}

/**
 * Ensures the given path has the given prefix.
 *
 * @example
 * ```js
 * ensurePathPrefix('/bar', '/foo'); // '/foo/bar'
 * ensurePathPrefix('/foo/bar', '/foo'); // '/foo/bar'
 * ```
 *
 * @param  path
 * @param  prefix
 * @returns Path with the prefix added.
 */
export function ensurePathPrefix(path: string, prefix: string): string {
	if (!prefix || path.startsWith(prefix)) {
		return path;
	}
	return prefix + path;
}
