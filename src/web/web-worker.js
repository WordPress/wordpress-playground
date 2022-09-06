
import PHPWrapper from '../shared/php-wrapper.mjs';
import WordPress from '../shared/wordpress.mjs';

class WPBrowser {
	constructor( wp ) {
		this.wp = wp;
		this.cookies = {};
	}

	async request( request, redirects = 0 ) {
		const response = await this.wp.request( {
			...request,
			_COOKIE: this.cookies,
		} );

		if ( response.headers[ 'set-cookie' ] ) {
			this.setCookies( response.headers[ 'set-cookie' ] );
		}

		if ( response.headers.location && redirects < 4 ) {
			console.log( 'WP RESPONSE', response );
			const parsedUrl = new URL( response.headers.location[ 0 ], this.wp.ABSOLUTE_URL );
			return this.request( {
				path: parsedUrl.pathname,
				method: 'GET',
				_GET: parsedUrl.search,
				headers: {},
			}, redirects + 1 );
		}

		return response;
	}

	setCookies( cookies ) {
		for ( const cookie of cookies ) {
			try {
				const value = cookie.split( '=' )[ 1 ].split( ';' )[ 0 ];
				const name = cookie.split( '=' )[ 0 ];
				this.cookies[ name ] = value;
			} catch ( e ) {
				console.error( e );
			}
		}
	}
}

if ( 'function' === typeof importScripts ) {
	console.log( '[WebWorker] Spawned' );

	// Polyfill for the emscripten loader
	document = {};

	importScripts( '/php-web.js' );

	let isReady = false;
	async function init() {
		const php = new PHPWrapper( );
		await php.init( PHP, {
			async onPreInit( FS, phpModule ) {
				globalThis.PHPModule = phpModule;
				importScripts( '/wp.js' );
				importScripts( '/wp-lazy-files.js' );
				setupLazyFiles( FS );
				FS.mkdirTree( '/usr/local/etc' );
				FS.createLazyFile( '/usr/local/etc', 'php.ini', '/etc/php.ini', true, false );
			},
		} );

		const wp = new WordPress( php );
		await wp.init( location.href );

		isReady = true;

		postMessage( {
			type: 'ready',
		} );
		return new WPBrowser( wp );
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
