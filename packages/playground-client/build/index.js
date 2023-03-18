import { consumeAPI } from '@wordpress/php-wasm';

// import type { PlaygroundAPI } from '@wordpress/playground/boot-playground';
/**
 * Connects to a remote Playground instance and returns its API.
 *
 * @param remoteWindow Window where WordPress Playground is loaded
 * @returns Playground API object
 */
function connect(remoteWindow) {
    return consumeAPI(remoteWindow);
}

export { connect };
