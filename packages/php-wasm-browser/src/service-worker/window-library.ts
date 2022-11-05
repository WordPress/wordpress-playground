/**
 * Run this in the main application to register the service worker.
 *
 * @param {string} scriptUrl The URL of the service worker script.
 */
export async function registerServiceWorker(scriptUrl) {
	const sw = (navigator as any).serviceWorker;
	if (!sw) {
		throw new Error('Service workers are not supported in this browser.');
	}

	const registration = await sw.register(scriptUrl);
	await registration.update();
	sw.startMessages();
}
