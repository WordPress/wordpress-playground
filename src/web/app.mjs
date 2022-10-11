import { postMessageExpectReply, awaitReply, responseTo, DEFAULT_REPLY_TIMEOUT } from '../shared/messaging.mjs';

if ( ! navigator.serviceWorker ) {
	alert( 'Service workers are not supported by your browser' );
}

// <SERVICE WORKER>
// Register the service worker and handle any HTTP WordPress requests it provides us:
const serviceWorkerReady = navigator.serviceWorker.register( `/service-worker.js` );
const serviceWorkerChannel = new BroadcastChannel('wordpress-service-worker');
serviceWorkerChannel.addEventListener( 'message', async function onMessage( event ) {
	console.debug(`[Main] "${event.data.type}" message received from a service worker`);
	
	let result;
	if (event.data.type === 'is_ready') {
		result = isReady;
	}
	else if (event.data.type === 'request' || event.data.type === 'httpRequest') {
		// Forward any HTTP requests to a worker to resolve them in another process.
		// This way they won't slow down the UI interactions.
		const worker = await wasmWorker;
		result = await worker.HTTPRequest(event.data.request);
	}
	
	// The service worker expects a response when it includes a `messageId` in the message:
	if (event.data.messageId) {
		serviceWorkerChannel.postMessage(
			responseTo(
				event.data.messageId,
				result
			)
		);
	}
	console.debug( `[Main] "${ event.data.type }" message processed`, { result } );
});
// </SERVICE WORKER>


// <WASM WORKER>
const wasmWorker = createWordPressWorker(
	{
		// @TODO: Use a dynamic URL, not a hardcoded one:
		backend: iframeWorkerBackend("http://127.0.0.1:8778/iframe-worker.html"),
		// backend: webWorkerBackend("/wasm-worker.js"),
		wordPressSiteURL: location.href
	}
);

async function createWordPressWorker({ backend, wordPressSiteURL }) {
	// Keep asking if the worker is alive until we get a response
	while (true) {
		try {
			await backend.sendMessage({ type: 'is_alive' }, 50);
			break;
		} catch (e) {
			// Ignore timeouts
		}
		// Sleep 100ms
		await new Promise(resolve => setTimeout(resolve, 50));
	}

	// Now that the worker is up and running, let's ask it to initialize
	// WordPress:
	await backend.sendMessage({
		type: 'initialize_wordpress',
		siteURL: wordPressSiteURL
	});

	return {
		async HTTPRequest(request) {
			return await backend.sendMessage({
				type: 'request',
				request
			})
		}
	};
}

function webWorkerBackend(workerURL) {
	const worker = new Worker(workerURL);
	return {
		sendMessage: async function( message, timeout=DEFAULT_REPLY_TIMEOUT ) {
			const messageId = postMessageExpectReply(worker, message);
			const response = await awaitReply(worker, messageId, timeout);
			return response;
		}
	};
}

function iframeWorkerBackend(workerDocumentURL) {
	const iframe = document.createElement('iframe');
	iframe.src = workerDocumentURL;
	iframe.style.display = 'none';
	document.body.appendChild(iframe);
	return {
		sendMessage: async function( message, timeout=DEFAULT_REPLY_TIMEOUT ) {
			const messageId = postMessageExpectReply(iframe.contentWindow, message, '*');
			const response = await awaitReply(window, messageId, timeout);
			return response;
		}
	};
}

// </WASM WORKER>

let isReady = false;
async function init() {
	console.log("[Main] Initializing the worker")
	await wasmWorker;
	await serviceWorkerReady;
	isReady = true;
    console.log("[Main] Iframe is ready")
	
	const WPIframe = document.querySelector('#wp');
	WPIframe.src = '/wp-login.php';
}
init();
