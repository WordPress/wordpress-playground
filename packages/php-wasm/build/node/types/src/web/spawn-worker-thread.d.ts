export declare const recommendedWorkerBackend: string;
/**
 * Spawns a new Worker Thread.
 *
 * @param  workerUrl The absolute URL of the worker script.
 * @param  workerBackend     The Worker Thread backend to use. Either 'webworker' or 'iframe'.
 * @param  config
 * @returns The spawned Worker Thread.
 */
export declare function spawnPHPWorkerThread(workerUrl: string, workerBackend?: 'webworker' | 'iframe', startupOptions?: Record<string, string>): Window | Worker;
