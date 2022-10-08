import { postMessageFactory, replyTo } from '../shared/messaging.mjs';

if ( ! navigator.serviceWorker ) {
	alert( 'Service workers are not supported by your browser' );
}

const serviceWorkerReady = navigator.serviceWorker.register( `/service-worker.js` );
const workerChannel = document.querySelector('iframe').contentWindow;
const webWorkerReady = new Promise( ( resolve ) => {
    const callback = (event) => {
		if ( event.data.type === 'ready' ) {
			resolve();
			workerChannel.removeEventListener( 'message', callback );
		}
	};
	workerChannel.addEventListener( 'message', callback );
} );

async function init() {
	await serviceWorkerReady;
    await webWorkerReady;
	const postMessage = postMessageFactory( workerChannel );
	workerChannel.addEventListener( 'message', async ( event ) => {
		if ( event.data.type === 'goto' ) {
			document.querySelector( '#wp' ).src = event.data.path;
		}
		console.log( '[APP.js] Got a message', event );
		const response = await postMessage( event.data );
		console.log( '[APP.js] Got a response', response );
		replyTo( event, response, parent );
	} );
	document.querySelector( '#wp' ).src = '/wp-login.php';
}
init();
