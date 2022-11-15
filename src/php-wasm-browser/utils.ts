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
 * getPathQueryFragment(url); // '/foo/bar?baz=qux#quux'
 * ```
 *
 * @param  url The URL.
 * @returns The path, query, and fragment.
 */
export function getPathQueryFragment(url: URL): string {
	return url.toString().substring(url.origin.length);
}
