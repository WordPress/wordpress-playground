/* eslint-disable no-inner-declarations */

import PHPWrapper from '../shared/php-wrapper.mjs';
import WordPress from '../shared/wordpress.mjs';
import WPBrowser from '../shared/wp-browser.mjs';

console.log( '[WebWorker] Spawned' );

// Polyfill for the emscripten loader
document = {};

let isReady = false;
async function init() {
	const php = new PHPWrapper( );
	await php.init( PHP, {
		async onPreInit( FS, phpModule ) {
			globalThis.PHPModule = phpModule;
			const script = document.createElement('script')
			script.src = '/wp.js';
			document.body.appendChild(script);
			FS.mkdirTree( '/usr/local/etc' );
			FS.writeFile( '/usr/local/etc/php.ini', `[PHP]

			error_reporting = E_ERROR | E_PARSE
			display_errors = 1
			html_errors = 1
			display_startup_errors = On
			` );
		},
	} );

	const wp = new WordPress( php );
	await wp.init( location.href );

	isReady = true;

	postMessage( {
		type: 'ready',
	} );
	return new WPBrowser( wp, { handleRedirects: true } );
}

const browser = init();

function messageHandler( responseChannel ) {
	return async function onMessage( event ) {
		console.debug( `[WebWorker] "${ event.data.type }" event received` );
		const _browser = await browser;
		let result;
		if ( event.data.type === 'run_php' ) {
			result = await _browser.wp.php.run( event.data.code );
		} else if ( event.data.type === 'request' || event.data.type === 'httpRequest' ) {
			const parsedUrl = new URL( event.data.request.path, _browser.wp.ABSOLUTE_URL );
			console.log( parsedUrl );
			result = await _browser.request( {
				...event.data.request,
				path: parsedUrl.pathname,
				_GET: parsedUrl.search,
			} );
		} else if ( event.data.type === 'is_ready' ) {
			result = isReady;
		} else {
			console.debug( `[WebWorker] "${ event.data.type }" event has no handler, short-circuiting` );
			return;
		}
		if ( event.data.requestId ) {
			responseChannel.postMessage( {
				type: 'response',
				result,
				requestId: event.data.requestId,
			} );
		}
		console.debug( `[WebWorker] "${ event.data.type }" event processed` );
	};
}

const workerChannel = new BroadcastChannel( 'wordpress-service-worker' );
workerChannel.addEventListener( 'message', messageHandler( workerChannel ) );
window.onmessage = messageHandler( window );
