import type { PHPResponse } from '@wordpress/php-wasm';
/**
 * Connects to a remote Playground instance and returns its API.
 *
 * @param remoteWindow Window where WordPress Playground is loaded
 * @returns Playground API object
 */
export declare function connect(remoteWindow: Window): PHPResponse;
