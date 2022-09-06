import * as React from 'react';
import { useEffect } from 'react';

if ( ! navigator.serviceWorker ) {
	alert( 'Service workers are not supported by your browser' );
}
const serviceWorkerReady = navigator.serviceWorker.register( `/slim-service-worker.js` );

const myWebWorker = new Worker( 'webworker.js' );
const webWorkerReady = new Promise( ( resolve ) => {
	const callback = ( event ) => {
		if ( event.data.type === 'ready' ) {
			resolve();
			myWebWorker.removeEventListener( 'message', callback );
		}
	};
	myWebWorker.addEventListener( 'message', callback );
} );

export const WordPressBrowser = React.forwardRef(
	function WordPressBrowserComponent( { initialUrl, ...props }, iframeElRef ) {
		useEffect( () => {
			async function init() {
				await serviceWorkerReady;
				await webWorkerReady;
				iframeElRef.current.src = initialUrl;
			}
			init();
		}, [] );

		return (
			<div { ...props }>
				<iframe ref={ iframeElRef } title="WordPress" width="100%" height="100%" className="border-solid border-1 border-indigo-600" />
			</div>
		);
	},
);

export default WordPressBrowser;
