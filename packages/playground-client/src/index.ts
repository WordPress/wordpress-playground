import { consumeAPI } from '@wordpress/php-wasm';
import type { PHPResponse } from '@wordpress/php-wasm';
// import type { PlaygroundAPI } from '@wordpress/playground/boot-playground';


/**
 * Connects to a remote Playground instance and returns its API.
 * 
 * @param remoteWindow Window where WordPress Playground is loaded
 * @returns Playground API object
 */
export function connect(remoteWindow: Window): PHPResponse {
    return consumeAPI<PHPResponse>(remoteWindow);
}
