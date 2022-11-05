export { PHP, startPHP } from './php';
export type { PHPOutput, JavascriptRuntime, ErrnoError } from './php';

import PHPServer from './php-server';
export { PHPServer };
export type {
	PHPRequest,
	PHPResponse,
	PHPServerConfigation,
} from './php-server';

import PHPBrowser from './php-browser';
export { PHPBrowser };

// Provided by esbuild – see build.js in the repo root.
declare let PHP_JS_HASH: any;
/**
 * Hash of the emscripten-compiled php.js file. Used for cache busting in
 * web browsers.
 *
 * @public
 */
export const phpJsHash = PHP_JS_HASH;
