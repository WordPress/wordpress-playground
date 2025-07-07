/// <reference lib="WebWorker" />

/**
 * **Call this inside a service worker.**
 * These errors include Playground errors like Asyncify errors. PHP errors
 * won't trigger this event.
 *
 * Reports service worker metrics.
 * Allows the logger to request metrics from the service worker by sending a
 * message. The service worker will respond with the number of open Playground
 * tabs.
 *
 * @param worker The service worker
 */
export const reportServiceWorkerMetrics = (
	worker: ServiceWorkerGlobalScope
) => {
	worker.addEventListener('activate', () => {
		worker.clients.matchAll().then((clients) => {
			const metrics = {
				numberOfOpenPlaygroundTabs: clients.filter(
					// Only count top-level frames to get the number of tabs.
					(c) => c.frameType === 'top-level'
				).length,
			};
			for (const client of clients) {
				client.postMessage(metrics);
			}
		});
	});
};
