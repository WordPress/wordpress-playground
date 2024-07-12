import { PHPWorker } from '@php-wasm/universal';
import { PhpWasmError } from '@php-wasm/util';
import { responseTo } from '@php-wasm/web-service-worker';
import { Remote } from 'comlink';

export interface Client extends Remote<PHPWorker> {}

let phpApi: Client;

/**
 * Sets the PHP API client.
 *
 * @param {Client} api The PHP API client.
 */
export function setPhpApi(api: Client) {
	phpApi = api;
}

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
export async function registerServiceWorker(scope: string, scriptUrl: string) {
	const sw = navigator.serviceWorker;
	if (!sw) {
		/**
		 * Service workers may only run in secure contexts.
		 * See https://w3c.github.io/webappsec-secure-contexts/
		 */
		if (window.isSecureContext) {
			throw new PhpWasmError(
				'Service workers are not supported in your browser.'
			);
		} else {
			throw new PhpWasmError(
				'WordPress Playground uses service workers and may only work on HTTPS and http://localhost/ sites, but the current site is neither.'
			);
		}
	}

	const registration = await sw.register(scriptUrl, {
		type: 'module',
		// Always bypass HTTP cache when fetching the new Service Worker script:
		updateViaCache: 'none',
	});

	// Check if there's a new service worker available and, if so, enqueue
	// the update:
	await registration.update();

	registration.addEventListener('worker-api', (event: CustomEventInit) => {
		if (!event.detail.workerApi) {
			return;
		}
		phpApi = event.detail.workerApi;
	});

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

			const args = event.data.args || [];

			const method = event.data.method as keyof Client;
			const result = await (phpApi[method] as Function)(...args);
			event.source!.postMessage(responseTo(event.data.requestId, result));
		}
	);

	sw.startMessages();

	return registration;
}
