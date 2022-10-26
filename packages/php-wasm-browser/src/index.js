import { startPHP } from 'php-wasm';
import EmscriptenDownloadMonitor from './emscripten-download-monitor';

export { initializeWorkerThread, loadPHPWithProgress } from './worker-thread';
export { startPHPWorkerThread } from './spawn-worker-thread';
export { setURLScope } from './scope';
export { registerServiceWorker, initializeServiceWorker, seemsLikeAPHPServerPath } from './service-worker';
export { postMessageExpectReply, awaitReply, responseTo } from './messaging';
export { cloneResponseMonitorProgress } from './emscripten-download-monitor';

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
 * @param {URL} url The URL.
 * @returns {string} The path, query, and fragment.
 */
export function getPathQueryFragment(url) {
	return url.toString().substring(url.origin.length);
}
