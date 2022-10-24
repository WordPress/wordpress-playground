/* eslint-disable no-undef */

// Provided by esbuild – see build.js in the repo root.
export const serviceWorkerUrl = SERVICE_WORKER_URL;
export const serviceWorkerOrigin = new URL(serviceWorkerUrl).origin;
export const wordPressSiteUrl = serviceWorkerOrigin;

export const wasmWorkerUrl = WASM_WORKER_THREAD_SCRIPT_URL;
export const wasmWorkerBackend = WASM_WORKER_BACKEND;
export const wpJsCacheBuster = WP_JS_HASH;

import { phpJsHash } from 'php-wasm';
export { phpJsHash as phpJsCacheBuster } from 'php-wasm';

export const cacheBuster = CACHE_BUSTER;
