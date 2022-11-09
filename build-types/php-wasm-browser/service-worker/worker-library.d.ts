/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/**
 * Run this function in the service worker to install the required event
 * handlers.
 *
 * @param  config
 */
export declare function initializeServiceWorker(config: ServiceWorkerConfiguration): void;
interface ServiceWorkerConfiguration {
    broadcastChannel?: BroadcastChannel;
    shouldForwardRequestToPHPServer?: (request: Request, unscopedUrl: URL) => boolean;
}
/**
 * Guesses whether the given path looks like a PHP file.
 *
 * @example
 * ```js
 * seemsLikeAPHPServerPath('/index.php') // true
 * seemsLikeAPHPServerPath('/index.php') // true
 * seemsLikeAPHPServerPath('/index.php/foo/bar') // true
 * seemsLikeAPHPServerPath('/index.html') // false
 * seemsLikeAPHPServerPath('/index.html/foo/bar') // false
 * seemsLikeAPHPServerPath('/') // true
 * ```
 *
 * @param  path The path to check.
 * @returns Whether the path seems like a PHP server path.
 */
export declare function seemsLikeAPHPServerPath(path: string): boolean;
export {};
