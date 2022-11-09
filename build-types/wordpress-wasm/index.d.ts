import { SpawnedWorkerThread, DownloadProgressCallback } from '../php-wasm-browser';
export declare function bootWordPress(config: BootConfiguration): Promise<SpawnedWorkerThread>;
export interface BootConfiguration {
    onWasmDownloadProgress: DownloadProgressCallback;
}
