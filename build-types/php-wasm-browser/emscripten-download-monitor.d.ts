/**
 * Monitors the download progress of Emscripten modules
 *
 * Usage:
 * ```js
 *   const downloadMonitor = new EmscriptenDownloadMonitor();
 * 	 const php = await startPHP(
 *       phpLoaderModule,
 *       'web',
 *       downloadMonitor.phpArgs
 *   );
 *   downloadMonitor.addEventListener('progress', (e) => {
 *     console.log( e.detail.progress);
 *   })
 * ```
 */
export declare class EmscriptenDownloadMonitor extends EventTarget {
    #private;
    assetsSizes: Record<string, number>;
    phpArgs: any;
    constructor(assetsSizes: Record<string, number>);
}
export default EmscriptenDownloadMonitor;
export interface DownloadProgressEvent {
    /**
     * The number of bytes loaded so far.
     */
    loaded: number;
    /**
     * The total number of bytes to load.
     */
    total: number;
}
/**
 * Clones a fetch Response object and returns a version
 * that calls the `onProgress` callback as the progress
 * changes.
 *
 * @param  response   The fetch Response object to clone.
 * @param  onProgress The callback to call when the download progress changes.
 * @returns The cloned response
 */
export declare function cloneResponseMonitorProgress(response: Response, onProgress: DownloadProgressCallback): Response;
export declare type DownloadProgressCallback = (event: DownloadProgressEvent) => void;
