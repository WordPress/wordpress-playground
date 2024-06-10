import {
	postMessageExpectReply,
	responseTo,
	awaitReply,
} from '@php-wasm/web-service-worker';

const sw = navigator.serviceWorker;
if (!sw) {
	/**
	 * Service workers may only run in secure contexts.
	 * See https://w3c.github.io/webappsec-secure-contexts/
	 */
	if (window.isSecureContext) {
		throw new Error('Service workers are not supported in your browser.');
	} else {
		throw new Error(
			'WordPress Playground uses service workers and may only work on HTTPS and http://localhost/ sites, but the current site is neither.'
		);
	}
}

const registration = await sw.register('/service-worker.js', {
	// Always bypass HTTP cache when fetching the new Service Worker script:
	updateViaCache: 'none',
});

// Check if there's a new service worker available and, if so, enqueue
// the update:
await registration.update();

// Proxy the service worker messages to the web worker:
navigator.serviceWorker.addEventListener(
	'message',
	async function onMessage(event) {
		const requestId = postMessageExpectReply(
			window.parent,
			{
				type: 'playground-extension-sw-message',
				data: event.data,
			},
			'*'
		);
		const response = await awaitReply(window, requestId);
		event.source!.postMessage(responseTo(event.data.requestId, response));
	}
);
sw.startMessages();
