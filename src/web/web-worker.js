/* eslint-disable no-inner-declarations */

console.log( '[WebWorker] Spawned' );
importScripts( '/webworker-php.js' );

new EmscriptenPHPModule( {} );
console.log( '[WebWorker] PHP initializing' );
