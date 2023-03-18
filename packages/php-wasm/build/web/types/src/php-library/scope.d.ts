/**
 * Scopes are unique strings, like `96253`, used to uniquely brand
 * the outgoing HTTP traffic from each browser tab. This helps the
 * main thread distinguish between the relevant and irrelevant
 * messages received from the Service Worker.
 *
 * Scopes are included in the `PHPServer.absoluteUrl` as follows:
 *
 * An **unscoped** URL: http://localhost:8778/wp-login.php
 * A **scoped** URL:    http://localhost:8778/scope:96253/wp-login.php
 *
 * For more information, see the README section on scopes.
 */
/**
 * Checks if the given URL contains scope information.
 *
 * @example
 * ```js
 * isURLScoped(new URL('http://localhost/scope:96253/index.php'));
 * // true
 *
 * isURLScoped(new URL('http://localhost/index.php'));
 * // false
 * ```
 *
 * @param  url The URL to check.
 * @returns `true` if the URL contains scope information, `false` otherwise.
 */
export declare function isURLScoped(url: URL): boolean;
/**
 * Returns the scope stored in the given URL.
 *
 * @example
 * ```js
 * getScopeFromURL(new URL('http://localhost/scope:96253/index.php'));
 * // '96253'
 *
 * getScopeFromURL(new URL('http://localhost/index.php'));
 * // null
 * ```
 *
 * @param  url The URL.
 * @returns The scope if the URL contains a scope, `null` otherwise.
 */
export declare function getURLScope(url: URL): string | null;
/**
 * Returns a new URL with the requested scope information.
 *
 * @example
 * ```js
 * setURLScope(new URL('http://localhost/index.php'), '96253');
 * // URL('http://localhost/scope:96253/index.php')
 *
 * setURLScope(new URL('http://localhost/scope:96253/index.php'), '12345');
 * // URL('http://localhost/scope:12345/index.php')
 *
 * setURLScope(new URL('http://localhost/index.php'), null);
 * // URL('http://localhost/index.php')
 * ```
 *
 * @param  url   The URL to scope.
 * @param  scope The scope value.
 * @returns A new URL with the scope information in it.
 */
export declare function setURLScope(url: URL | string, scope: string): URL;
/**
 * Returns a new URL without any scope information.
 *
 * @example
 * ```js
 * removeURLScope(new URL('http://localhost/scope:96253/index.php'));
 * // URL('http://localhost/index.php')
 *
 * removeURLScope(new URL('http://localhost/index.php'));
 * // URL('http://localhost/index.php')
 * ```
 *
 * @param  url The URL to remove scope information from.
 * @returns A new URL without the scope information.
 */
export declare function removeURLScope(url: URL): URL;
