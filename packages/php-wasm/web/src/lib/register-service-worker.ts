import { PHPWorker } from '@php-wasm/universal';
import { PhpWasmError } from '@php-wasm/util';
import { responseTo } from '@php-wasm/web-service-worker';
import { Remote } from 'comlink';
import { logger } from '@php-wasm/logger';

export interface Client extends Remote<PHPWorker> {}

/**
 * Resolves when the PHP API client is set.
 *
 * This allows us to wait for the PHP API client to be set before proxying service worker messages to the web worker.
 */
let resolvePhpApi: (api: Client) => void;
export const phpApiPromise = new Promise<Client>((resolve) => {
	resolvePhpApi = resolve;
});

/**
 * Sets the PHP API client.
 *
 * @param {Client} api The PHP API client.
 *
 */
export function setPhpApi(api: Client) {
	if (!api) {
		throw new PhpWasmError('PHP API client must be a valid client object.');
	}
	resolvePhpApi(api);
}

/**
 * Run this in the main application to register the service worker or
 * reload the registered worker if the app expects a different version
 * than the currently registered one.
 *
 * @param scope       The numeric value used in the path prefix of the site
 *                    this service worker is meant to serve. E.g. for a prefix
 *                    like `/scope:793/`, the scope would be `793`. See the
 *                    `@php-wasm/scopes` package for more details.
 * @param scriptUrl   The URL of the service worker script.
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
	try {
		await registration.update();
	} catch (e) {
		// registration.update() throws if it can't reach the server.
		// We're swallowing the error to keep the app working in offline mode
		// or when playground.wordpress.net is down. We can be sure we have a functional
		// service worker at this point because sw.register() succeeded.
		logger.error('Failed to update service worker.', e);
	}

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

			// Wait for the PHP API client to be set by bootPlaygroundRemote
			const phpApi = await phpApiPromise;

			const args = event.data.args || [];
			const method = event.data.method as keyof Client;
			const result = await (phpApi[method] as Function)(...args);
			event.source!.postMessage(responseTo(event.data.requestId, result));
		}
	);

	sw.startMessages();
}
