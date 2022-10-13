import { postMessageExpectReply, awaitReply, responseTo, DEFAULT_REPLY_TIMEOUT } from '../shared/messaging.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, 50));

// <SERVICE WORKER>
// Register the service worker and handle any HTTP WordPress requests it provides us:
export async function registerServiceWorker(url, onRequest) {
	if ( ! navigator.serviceWorker ) {
		alert('Service workers are not supported in this browser.');
		throw new Exception('Service workers are not supported in this browser.');
	}
	await navigator.serviceWorker.register(url);
	const serviceWorkerChannel = new BroadcastChannel('wordpress-service-worker');
	serviceWorkerChannel.addEventListener('message', async function onMessage(event) {
		console.debug(`[Main] "${event.data.type}" message received from a service worker`);

		let result;
		if (event.data.type === 'request' || event.data.type === 'httpRequest') {
			result = await onRequest(event.data.request);
		} else {
			throw new Error(`[Main] Unexpected message received from the service-worker: "${event.data.type}"`);
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
		console.debug(`[Main] "${event.data.type}" message processed`, { result });
	});
	navigator.serviceWorker.startMessages();

	// Without sleep(0), the request below always returns 404.
	// @TODO: Figure out why.
	await sleep(0); 

	const wordPressDomain = new URL(url).origin;
	const response = await fetch(`${wordPressDomain}/wp-admin/atomlib.php`);
	if (!response.ok) {
		// The service worker did not claim this page for some reason. Let's reload.
		window.location.reload();
	}
}
// </SERVICE WORKER>

// <WASM WORKER>
export async function createWordPressWorker({ backend, wordPressSiteUrl }) {
	// Keep asking if the worker is alive until we get a response
	while (true) {
		try {
			await backend.sendMessage({ type: 'is_alive' }, 50);
			break;
		} catch (e) {
			// Ignore timeouts
		}
		await sleep(50);
	}

	// Now that the worker is up and running, let's ask it to initialize
	// WordPress:
	await backend.sendMessage({
		type: 'initialize_wordpress',
		siteURL: wordPressSiteUrl
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

export function getWorkerBackend(key, url) {
	const backends = {
		webworker: webWorkerBackend,
		shared_worker: sharedWorkerBackend,
		iframe: iframeBackend,
	}
	const backend = backends[key];
	if (!backend) {
		const availableKeys = Object.keys(backends).join(", ");
		throw new Error(`Unknown worker backend: "${key}". Choices: ${availableKeys}`);
	}
	return backend(url);
}

export function webWorkerBackend(workerURL) {
	const worker = new Worker(workerURL);
	return {
		sendMessage: async function( message, timeout=DEFAULT_REPLY_TIMEOUT ) {
			const messageId = postMessageExpectReply(worker, message);
			const response = await awaitReply(worker, messageId, timeout);
			return response;
		}
	};
}

export function sharedWorkerBackend(workerURL) {
	const worker = new SharedWorker(workerURL);
	worker.port.start();
	return {
		sendMessage: async function( message, timeout=DEFAULT_REPLY_TIMEOUT ) {
			const messageId = postMessageExpectReply(worker.port, message);
			const response = await awaitReply(worker.port, messageId, timeout);
			return response;
		}
	};
}

export function iframeBackend(workerDocumentURL) {
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
