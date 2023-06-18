import type { WebPHPEndpoint } from './web-php-endpoint';
import { responseTo } from '@php-wasm/web-service-worker';
import { Remote } from 'comlink';

/**
 * Run this in the main application to register the service worker or
 * reload the registered worker if the app expects a different version
 * than the currently registered one.
 *
 * @param {string} scriptUrl       The URL of the service worker script.
 * @param {string} expectedVersion The expected version of the service worker script. If
 *                                 mismatched with the actual version, the service worker
 *                                 will be re-registered.
 */
export async function registerServiceWorker<
	Client extends Remote<WebPHPEndpoint>
>(phpApi: Client, scope: string, scriptUrl: string) {
	const sw = navigator.serviceWorker;
	if (!sw) {
		throw new Error('Service workers are not supported in this browser.');
	}

	console.debug(`[window][sw] Registering a Service Worker`);
	const registration = await sw.register(scriptUrl, {
		type: 'module',
		// Always bypass HTTP cache when fetching the new Service Worker script:
		updateViaCache: 'none',
	});

	// Check if there's a new service worker available and, if so, enqueue
	// the update:
	await registration.update();

	// Proxy the service worker messages to the worker thread:
	navigator.serviceWorker.addEventListener(
		'message',
		async function onMessage(event) {
			console.debug('[window][sw] Message from ServiceWorker', event);
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

			const args = event.data.args || [];

			const method = event.data.method as keyof Client;
			const result = await (phpApi[method] as Function)(...args);
			event.source!.postMessage(responseTo(event.data.requestId, result));
		}
	);

	sw.startMessages();
}
