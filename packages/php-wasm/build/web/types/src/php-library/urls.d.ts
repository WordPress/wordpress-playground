/**
 * The default base used to convert a path into the URL object.
 */
export declare const DEFAULT_BASE_URL = "http://example.com";
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
export declare function toRelativeUrl(url: URL): string;
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
export declare function removePathPrefix(path: string, prefix: string): string;
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
export declare function ensurePathPrefix(path: string, prefix: string): string;
