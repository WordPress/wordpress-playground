
export function postMessageFactory( target ) {
	let lastRequestId = 0;
	return function postMessage( data, timeout = 50000 ) {
		return new Promise( ( resolve, reject ) => {
			const requestId = ++lastRequestId;
			const responseHandler = ( event ) => {
				if ( event.data.type === 'response' && event.data.requestId === requestId ) {
					target.removeEventListener( 'message', responseHandler );
					clearTimeout( failOntimeout );
					resolve( event.data.result );
				}
			};
			const failOntimeout = setTimeout( () => {
				reject( 'Request timed out' );
				target.removeEventListener( 'message', responseHandler );
			}, timeout );
			target.addEventListener( 'message', responseHandler );

			target.postMessage( {
				...data,
				requestId,
			} );
		} );
	};
}

export function replyTo( event, result, target ) {
	target.postMessage( {
		type: 'response',
		requestId: event.data.requestId,
		result,
	}, event.origin );
}
