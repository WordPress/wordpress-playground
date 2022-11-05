/* eslint-disable no-undef */

// Provided by esbuild – see build.js in the repo root.
declare let SERVICE_WORKER_URL: any;
export const serviceWorkerUrl = SERVICE_WORKER_URL;
export const serviceWorkerOrigin = new URL(serviceWorkerUrl).origin;
export const wordPressSiteUrl = serviceWorkerOrigin;

declare let WASM_WORKER_THREAD_SCRIPT_URL: any;
export const wasmWorkerUrl = WASM_WORKER_THREAD_SCRIPT_URL;

declare let WASM_WORKER_BACKEND: any;
export const wasmWorkerBackend = WASM_WORKER_BACKEND;
declare let WP_JS_HASH: any;
export const wpJsCacheBuster = WP_JS_HASH;

export { phpJsHash as phpJsCacheBuster } from 'php-wasm';

declare let CACHE_BUSTER: any;
export const cacheBuster = CACHE_BUSTER;
