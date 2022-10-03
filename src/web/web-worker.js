/* eslint-disable no-inner-declarations */

import PHPWrapper from '../shared/php-wrapper.mjs';

if ( 'function' === typeof importScripts ) {
	console.log( '[WebWorker] Spawned' );

	// Polyfill for the emscripten loader
	document = {};

	importScripts( '/webworker-php.js' );

	async function init() {
		const php = new PHPWrapper( );
		await php.init( PHP, {} );
		console.log( 'loaded' );
	}

	init();
}
