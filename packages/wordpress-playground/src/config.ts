
export const wordPressSiteUrl = new URL('/', import.meta.url).origin;
export const wasmWorkerBackend = import.meta.env.DEV ? 'webworker-module' : 'webworker';

// Hardcoded in wp.js:
export const DOCROOT = '/wordpress';
