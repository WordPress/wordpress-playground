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
>(phpApi: Client, scope: string, scriptUrl: string, expectedVersion: string) {
	const sw = (navigator as any).serviceWorker;
	if (!sw) {
		throw new Error('Service workers are not supported in this browser.');
	}
	const registrations = await sw.getRegistrations();
	if (registrations.length > 0) {
		const actualVersion = await getRegisteredServiceWorkerVersion();
		if (expectedVersion !== actualVersion) {
			console.debug(
				`[window] Reloading the currently registered Service Worker ` +
					`(expected version: ${expectedVersion}, registered version: ${actualVersion})`
			);
			for (const registration of registrations) {
				registration.unregister();
				try {
					await registration.update();
				} catch(e) {
					console.warn(`[window] Failed to update the Service Worker registration:`, e);
				}
			}
			window.location.reload();
		}
	} else {
		console.debug(
			`[window] Creating a Service Worker registration (version: ${expectedVersion})`
		);
		await sw.register(scriptUrl, {
			type: 'module',
		});
	}

	// Proxy the service worker messages to the worker thread:
	navigator.serviceWorker.addEventListener(
		'message',
		async function onMessage(event) {
			console.debug('Message from ServiceWorker', event);
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

async function getRegisteredServiceWorkerVersion() {
	try {
		const response = await fetch('/version');
		const data = await response.json();
		return data.version;
	} catch (e) {
		return null;
	}
}
