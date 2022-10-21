/* eslint-disable no-undef */

// Provided by esbuild – see build.js in the repo root.
export const serviceWorkerUrl = SERVICE_WORKER_URL;
export const serviceWorkerOrigin = new URL(serviceWorkerUrl).origin;
export const wordPressSiteUrl = serviceWorkerOrigin;

export const wasmWorkerUrl = WASM_WORKER_THREAD_SCRIPT_URL;
export const wasmWorkerBackend = WASM_WORKER_BACKEND;
export const wpDataSize = WP_DATA_SIZE;
export const wpDataCacheBuster = WP_DATA_HASH;

export const cacheBuster = CACHE_BUSTER;

export { phpWebWasmSize, phpWasmHash as phpWasmCacheBuster } from 'php-wasm';
