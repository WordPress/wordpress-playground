/* eslint-disable no-inner-declarations */

import PHPWrapper from '../shared/php-wrapper.mjs';
import WordPress from '../shared/wordpress.mjs';
import WPBrowser from '../shared/wp-browser.mjs';

if ( 'function' === typeof importScripts ) {
	console.log( '[WebWorker] Spawned' );

	// Polyfill for the emscripten loader
	document = {};

	importScripts( '/webworker-php.js' );

		const php = new PHPWrapper( );
		await php.init( PHP, {
			async onPreInit( FS, phpModule ) {
				globalThis.PHPModule = phpModule;
				importScripts( '/wp.js' );
				FS.mkdirTree( '/usr/local/etc' );
				FS.createLazyFile( '/usr/local/etc', 'php.ini', '/etc/php.ini', true, false );

				importScripts( '/wp-lazy-files.js' );
				getLazyFiles().forEach( ( { path, filename, fullPath } ) => {
					FS.mkdirTree( '/usr/local/etc' );
					FS.createLazyFile( path, filename, fullPath, true, false );
				} );
			},
		} );
		console.log( 'loaded' );
	}

	init();
}
