import { postMessageFactory, replyTo } from '../shared/messaging.mjs';

if ( ! navigator.serviceWorker ) {
	alert( 'Service workers are not supported by your browser' );
}
const serviceWorkerReady = navigator.serviceWorker.register( `/service-worker.js` );

const myWebWorker = new Worker( 'web-worker.js' );
const webWorkerReady = new Promise( ( resolve ) => {
	const callback = ( event ) => {
		if ( event.data.type === 'ready' ) {
			resolve();
			myWebWorker.removeEventListener( 'message', callback );
		}
	};
	myWebWorker.addEventListener( 'message', callback );
} );

async function init() {
	await serviceWorkerReady;
	await webWorkerReady;
	const postMessage = postMessageFactory( myWebWorker );
	window.addEventListener( 'message', async ( event ) => {
		if ( event.data.type === 'goto' ) {
			document.querySelector( 'iframe' ).src = event.data.path;
		}
		console.log( '[APP.js] Got a message', event );
		const response = await postMessage( event.data );
		console.log( '[APP.js] Got a response', response );
		replyTo( event, response, parent );
	} );
	document.querySelector( 'iframe' ).src = '/wp-login.php';
}
init();
