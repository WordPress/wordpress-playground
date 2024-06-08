import {
	postMessageExpectReply,
	responseTo,
	awaitReply,
} from '@php-wasm/web-service-worker';
import serviceWorkerPath from '../service-worker.ts?worker&url';
export const serviceWorkerUrl = new URL(serviceWorkerPath, origin);

const scope = '777777777';
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

const registration = await sw.register(serviceWorkerUrl, {
	type: 'module',
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
		/**
		 * Ignore events meant for other PHP instances to
		 * avoid handling the same event twice.
		 *
		 * This is important because the service worker posts the
		 * same message to all application instances across all browser tabs.
		 */
		if (scope && event.data.scope !== scope) {
			return;
		}

		console.log('Relay received message:', event.data);
		const requestId = postMessageExpectReply(
			window.parent,
			{
				type: 'playground-extension-sw-message',
				data: event.data,
			},
			'*'
		);
		if (event.data.method === 'getWordPressModuleDetails') {
			event.source!.postMessage(
				responseTo(event.data.requestId, {
					version: '8.0.24',
					url: 'https://example.com',
					size: 123,
				})
			);
		} else {
			const response = await awaitReply(window, requestId);
			console.log('got response', response);
			event.source!.postMessage(
				responseTo(event.data.requestId, response)
			);
		}
	}
);
sw.startMessages();
