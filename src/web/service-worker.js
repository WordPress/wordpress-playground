import { postMessageFactory } from '../shared/messaging.mjs';
const workerChannel = new BroadcastChannel( 'wordpress-service-worker' );

const postWebWorkerMessage = postMessageFactory( workerChannel );

/**
 * The main method. It captures the requests and loop them back to the main
 * application using the Loopback request
 */
self.addEventListener( 'fetch', ( event ) => {
	event.preventDefault();
	return event.respondWith(
		new Promise( async ( accept ) => {
			const post = await parsePost( event.request );

			const url = new URL( event.request.url );
			const isInternalRequest = url.pathname.endsWith( '/' ) || url.pathname.endsWith( '.php' );

			if ( ! isInternalRequest ) {
				console.log( `[ServiceWorker] Ignoring request: ${ url.pathname }` );
				accept( fetch( event.request ) );
				return;
			}

			const requestHeaders = {};
			for ( const pair of event.request.headers.entries() ) {
				requestHeaders[ pair[ 0 ] ] = pair[ 1 ];
			}

			console.log( `[ServiceWorker] Serving request: ${ url.pathname }?${ url.search }` );

			let wpResponse;
			try {
				wpResponse = await postWebWorkerMessage( {
					type: 'httpRequest',
					request: {
						path: url.pathname + url.search,
						method: event.request.method,
						_POST: post,
						headers: requestHeaders,
					},
				} );
				console.log( { wpResponse } );
			} catch ( e ) {
				console.error( e );
				throw e;
			}

			accept( new Response(
				wpResponse.body,
				{
					headers: wpResponse.headers,
				},
			) );
		} ),
	);
} );

async function parsePost( request ) {
	if ( request.method !== 'POST' ) {
		return undefined;
	}
	// Try to parse the body as form data
	try {
		const formData = await request.clone().formData();
		const post = {};

		for ( const key of formData.keys() ) {
			post[ key ] = formData.get( key );
		}

		return post;
	} catch ( e ) { }

	// Try to parse the body as JSON
	return await request.clone().json();
}
