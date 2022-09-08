
import PHPWrapper from '../shared/php-wrapper.mjs';
import WordPress from '../shared/wordpress.mjs';
import WPBrowser from '../shared/wp-browser.mjs';

if ( 'function' === typeof importScripts ) {
	console.log( '[WebWorker] Spawned' );

	// Polyfill for the emscripten loader
	document = {};

	importScripts( '/webworker-php.js' );

	let isReady = false;
	async function init() {
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

		const wp = new WordPress( php );
		await wp.init( location.href );

		isReady = true;

		postMessage( {
			type: 'ready',
		} );
		return new WPBrowser( wp, { handleRedirects: true } );
	}

	const browser = init();

	const workerChannel = new BroadcastChannel( 'wordpress-service-worker' );
	workerChannel.addEventListener( 'message', async ( event ) => {
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
			workerChannel.postMessage( {
				type: 'response',
				result: isReady,
				requestId: event.data.requestId,
			} );
			return;
		} else {
			console.debug( `[WebWorker] "${ event.data.type }" event has no handler, short-circuiting` );
			return;
		}
		if ( event.data.requestId ) {
			workerChannel.postMessage( {
				type: 'response',
				result,
				requestId: event.data.requestId,
			} );
		}
		console.debug( `[WebWorker] "${ event.data.type }" event processed` );
	} );
}
