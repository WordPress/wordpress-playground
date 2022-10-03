/* eslint-disable no-inner-declarations */

console.log( '[WebWorker] Spawned' );
importScripts( '/webworker-php.js' );

new PHP( {} )
	.then( () => {
		console.log( '[WebWorker] PHP initialized' );
	} );
