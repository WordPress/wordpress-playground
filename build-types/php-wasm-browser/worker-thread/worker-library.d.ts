/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { PHPBrowser } from '../../php-wasm';
import type { PHP, JavascriptRuntime } from '../../php-wasm';
export * from '../scope';
/**
 * Call this in a worker thread script to set the stage for
 * offloading the PHP processing. This function:
 *
 * * Initializes the PHP runtime
 * * Starts PHPServer and PHPBrowser
 * * Lets the main app know when its ready
 * * Listens for messages from the main app
 * * Runs the requested operations (like `run_php`)
 * * Replies to the main app with the results using the [request/reply protocol](#request-reply-protocol)
 *
 * Remember: The worker thread code must live in a separate JavaScript file.
 *
 * A minimal worker thread script looks like this:
 *
 * ```js
 * import { initializeWorkerThread } from 'php-wasm-browser';
 * initializeWorkerThread();
 * ```
 *
 * You can customize the PHP loading flow via the first argument:
 *
 * ```js
 * import { initializeWorkerThread, loadPHPWithProgress } from 'php-wasm-browser';
 * initializeWorkerThread( bootBrowser );
 *
 * async function bootBrowser({ absoluteUrl }) {
 *     const [phpLoaderModule, myDependencyLoaderModule] = await Promise.all([
 *         import(`/php.js`),
 *         import(`/wp.js`)
 *     ]);
 *
 *     const php = await loadPHPWithProgress(phpLoaderModule, [myDependencyLoaderModule]);
 *
 *     const server = new PHPServer(php, {
 *         documentRoot: '/www',
 *         absoluteUrl: absoluteUrl
 *     });
 *
 *     return new PHPBrowser(server);
 * }
 * ```
 *
 * @param  config The worker thread configuration.
 * @return The backend object to communicate with the parent thread.
 */
export declare function initializeWorkerThread(config: WorkerThreadConfiguration): Promise<any>;
interface WorkerThreadConfiguration {
    /**
     * The PHP browser instance to use.
     */
    phpBrowser?: PHPBrowser;
    /**
     * The broadcast channel to use for communication
     *  with the service worker.
     */
    broadcastChannel?: BroadcastChannel;
}
interface WorkerThreadBackend {
    jsEnv: JavascriptRuntime;
    setMessageListener(handler: any): any;
    postMessageToParent(message: any): any;
}
/**
 * @returns
 */
export declare const currentBackend: WorkerThreadBackend;
/**
 * Call this in a Worker Thread to start load the PHP runtime
 * and post the progress to the main thread.
 *
 * @see startPHP
 * @param  phpLoaderModule         The ESM-wrapped Emscripten module. Consult the Dockerfile for the build process.
 * @param  dataDependenciesModules A list of the ESM-wrapped Emscripten data dependency modules.
 * @param  phpModuleArgs           The Emscripten module arguments, see https://emscripten.org/docs/api_reference/module.html#affecting-execution.
 * @returns PHP instance.
 */
export declare function loadPHPWithProgress(phpLoaderModule: any, dataDependenciesModules?: any[], phpModuleArgs?: any): Promise<PHP>;
