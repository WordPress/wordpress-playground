/**
 * This file exists to work around a Vite issue where it will inline .ts files
 * as "video/m2ts" data URIs which cannot be executed.
 *
 * @see https://github.com/vitejs/vite/issues/10271
 */
export * from './worker-thread-v2';
