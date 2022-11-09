import type { PHPOutput, PHPRequest, PHPResponse } from '../../php-wasm';
import type { DownloadProgressEvent } from '../emscripten-download-monitor';
interface WorkerThreadConfig {
    /**
     * A function to call when a download progress event is received from the worker
     */
    onDownloadProgress?: (event: DownloadProgressEvent) => void;
}
/**
 * Spawns a new Worker Thread.
 *
 * @param  backendName     The Worker Thread backend to use. Either 'webworker' or 'iframe'.
 * @param  workerScriptUrl The absolute URL of the worker script.
 * @param  config
 * @returns  The spawned Worker Thread.
 */
export declare function spawnPHPWorkerThread(backendName: string, workerScriptUrl: string, config: WorkerThreadConfig): Promise<SpawnedWorkerThread>;
export declare class SpawnedWorkerThread {
    messageChannel: any;
    serverUrl: any;
    constructor(messageChannel: any, serverUrl: any);
    /**
     * Converts a path to an absolute URL based at the PHPServer
     * root.
     *
     * @param  path The server path to convert to an absolute URL.
     * @returns The absolute URL.
     */
    pathToInternalUrl(path: string): string;
    /**
     * Converts an absolute URL based at the PHPServer to a relative path
     * without the server pathname and scope.
     *
     * @param  internalUrl An absolute URL based at the PHPServer root.
     * @returns The relative path.
     */
    internalUrlToPath(internalUrl: string): string;
    /**
     * Runs PHP code.
     *
     * @param  code The PHP code to run.
     * @returns The result of the PHP code.
     */
    eval(code: string): Promise<PHPOutput>;
    /**
     * Dispatches a request to the PHPServer.
     *
     * @param  request - The request to dispatch.
     * @returns  The response from the PHPServer.
     */
    HTTPRequest(request: PHPRequest): Promise<PHPResponse>;
}
export {};
