/**
 * This file is executed before vitests are run, and ensures
 * the required polyfills are loaded.
 *
 * @see tests.setupFiles in vite.config.ts
 */
import '@php-wasm/node-polyfills';
