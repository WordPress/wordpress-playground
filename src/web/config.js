/* eslint-disable no-undef */

// Provided by esbuild – see build.js in the repo root.
export const serviceWorkerUrl = SERVICE_WORKER_URL;
export const serviceWorkerOrigin = new URL(serviceWorkerUrl).origin;
export const wordPressSiteUrl = serviceWorkerOrigin;

export const wasmWorkerUrl = WASM_WORKER_URL;
export const wasmWorkerBackend = WASM_WORKER_BACKEND;
export const phpWebWasmSize = PHP_WASM_SIZE;
export const wpDataSize = WP_DATA_SIZE;

export const cacheBuster = CACHE_BUSTER;
export const phpWasmCacheBuster = PHP_WASM_CACHE_BUSTER;
export const wpDataCacheBuster = WP_DATA_CACHE_BUSTER;
