const DEFAULT_RESPONSE_TIMEOUT = 25000;
let lastRequestId = 0;
/**
 * Posts a message branded with a unique `requestId` to the given `target`.
 * Then returns the `requestId` so it can be used to await a reply.
 * Effectively, it implements the request/response dynamics on
 * of JavaScript's `postMessage`
 *
 * @example
 *
 * In the main app:
 *
 * ```js
 * import { postMessageExpectReply, awaitReply } from 'php-wasm-browser';
 * const iframeWindow = iframe.contentWindow;
 * const requestId = postMessageExpectReply(iframeWindow, {
 *    type: "get_php_version"
 * });
 * const response = await awaitReply(iframeWindow, requestId);
 * console.log(response);
 * // "8.0.24"
 * ```
 *
 * In the iframe:
 *
 * ```js
 * import { responseTo } from 'php-wasm-browser';
 * window.addEventListener('message', (event) => {
 *    let response = '8.0.24';
 *    if(event.data.type === 'get_php_version') {
 *       response = '8.0.24';
 *    } else {
 *       throw new Error(`Unexpected message type: ${event.data.type}`);
 *    }
 *
 *    // When `requestId` is present, the other thread expects a response:
 *    if (event.data.requestId) {
 *       const response = responseTo(event.data.requestId, response);
 *       window.parent.postMessage(response, event.origin);
 *    }
 * });
 * ```
 *
 * @param  target          An object that has a `postMessage` method.
 * @param  message         A key-value object that can be serialized to JSON.
 * @param  postMessageArgs Additional arguments to pass to `postMessage`.
 * @returns The message ID for awaitReply().
 */
function postMessageExpectReply(target, message, ...postMessageArgs) {
    const requestId = getNextRequestId();
    target.postMessage({
        ...message,
        requestId,
    }, ...postMessageArgs);
    return requestId;
}
function getNextRequestId() {
    return ++lastRequestId;
}
/**
 * Awaits a reply to the message with the given ID.
 *
 * @see postMessageExpectReply
 * @throws {@link Error} If the reply is not received within the timeout.
 * @param  messageTarget EventEmitter emitting `message` events, e.g. `window`
 *                       or a `Worker` instance.
 * @param  requestId     The message ID returned by postMessageExpectReply().
 * @param  timeout       The number of milliseconds to wait for a reply before
 *                       throwing an error.
 * @returns The reply from the messageTarget.
 */
function awaitReply(messageTarget, requestId, timeout = DEFAULT_RESPONSE_TIMEOUT) {
    return new Promise((resolve, reject) => {
        const responseHandler = (event) => {
            if (event.data.type === 'response' &&
                event.data.requestId === requestId) {
                messageTarget.removeEventListener('message', responseHandler);
                clearTimeout(failOntimeout);
                resolve(event.data.response);
            }
        };
        const failOntimeout = setTimeout(() => {
            reject(new Error('Request timed out'));
            messageTarget.removeEventListener('message', responseHandler);
        }, timeout);
        messageTarget.addEventListener('message', responseHandler);
    });
}
/**
 * Creates a response message to the given message ID.
 *
 * @see postMessageExpectReply
 * @param  requestId The message ID sent from the other thread by
 *                   `postMessageExpectReply` in the `message` event.
 * @param  response  The response to send back to the messageTarget.
 * @returns A message object that can be sent back to the other thread.
 */
function responseTo(requestId, response) {
    return {
        type: 'response',
        requestId,
        response,
    };
}

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
function isURLScoped(url) {
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
 * @param  url The URL.
 * @returns The scope if the URL contains a scope, `null` otherwise.
 */
function getURLScope(url) {
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
 * @param  url   The URL to scope.
 * @param  scope The scope value.
 * @returns A new URL with the scope information in it.
 */
function setURLScope(url, scope) {
    const newUrl = new URL(url);
    if (!scope) {
        return newUrl;
    }
    if (isURLScoped(newUrl)) {
        const parts = newUrl.pathname.split('/');
        parts[1] = `scope:${scope}`;
        newUrl.pathname = parts.join('/');
    }
    else {
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
 * @param  url The URL to remove scope information from.
 * @returns A new URL without the scope information.
 */
function removeURLScope(url) {
    if (!isURLScoped(url)) {
        return url;
    }
    const newUrl = new URL(url);
    const parts = newUrl.pathname.split('/');
    newUrl.pathname = '/' + parts.slice(2).join('/');
    return newUrl;
}

/**
 * The default base used to convert a path into the URL object.
 */
const DEFAULT_BASE_URL = 'http://example.com';
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
function toRelativeUrl(url) {
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
function removePathPrefix(path, prefix) {
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
function ensurePathPrefix(path, prefix) {
    if (!prefix || path.startsWith(prefix)) {
        return path;
    }
    return prefix + path;
}

export { DEFAULT_BASE_URL as D, awaitReply as a, getNextRequestId as b, removePathPrefix as c, responseTo as d, ensurePathPrefix as e, getURLScope as g, isURLScoped as i, postMessageExpectReply as p, removeURLScope as r, setURLScope as s, toRelativeUrl as t };
