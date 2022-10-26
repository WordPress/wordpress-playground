/**
 * Scopes are unique strings, like `96253`, used to uniquely brand
 * the outgoing HTTP traffic from each browser tab. This helps the
 * main thread distinguish between the relevant and irrelevant BroadcastChannel
 * messages from the Service Worker.
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
 * @param {URL} url The URL to check.
 * @returns {boolean} `true` if the URL contains scope information, `false` otherwise.
 */
export function isURLScoped(url) {
	return url.pathname.startsWith(`/scope:`);
}

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
 * @param {URL} url The URL.
 * @returns {string} The scope if the URL contains a scope, `null` otherwise.
 */
export function getURLScope(url) {
	if (isURLScoped(url)) {
		return url.pathname.split('/')[1].split(':')[1];
	}
	return null;
}

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
 * @param {URL} url The URL to scope.
 * @param {string} scope The scope value.
 * @returns {URL} A new URL with the scope information in it.
 */
export function setURLScope(url, scope) {
	if (!scope) {
		return url;
	}
	const newUrl = new URL(url);

	if (isURLScoped(newUrl)) {
		const parts = newUrl.pathname.split('/');
		parts[1] = `scope:${scope}`;
		newUrl.pathname = parts.join('/');
	} else {
		const suffix = newUrl.pathname === '/' ? '' : newUrl.pathname;
		newUrl.pathname = `/scope:${scope}${suffix}`;
	}

	return newUrl;
}

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
 * @param {URL} url The URL to remove scope information from.
 * @returns {URL} A new URL without the scope information.
 */
export function removeURLScope(url) {
	if (!isURLScoped(url)) {
		return url;
	}
	const newUrl = new URL(url);
	const parts = newUrl.pathname.split('/');
	newUrl.pathname = '/' + parts.slice(2).join('/');
	return newUrl;
}
