/* eslint-disable no-inner-declarations */

console.log( '[WebWorker] Spawned' );

// Polyfill for the emscripten loader
document = {};

importScripts( '/webworker-php.js' );

new PHP( {} )
	.then( () => {
		console.log( '[WebWorker] PHP initialized' );
	} );
