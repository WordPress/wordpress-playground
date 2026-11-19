/**
 * A bridge script as builds from the root-only production layout shipped it.
 *
 * Those builds' WordPress workers generated bridge HTML loading their own
 * /wordpress-bridge-<hash>.js from the app host. Like those bundles, this module
 * derives the app origin from its own URL and keeps the original message format.
 * bin/wordpress-frame/build.mjs places it in a private release of that layout so
 * the installer indexes it; the router must then serve it at its original root URL.
 */
const appOrigin = new URL(import.meta.url).origin;
const scope = new URL(window.location.href).searchParams.get('scope');
const registration = await navigator.serviceWorker.register('/sw.js', {
	type: 'module',
	updateViaCache: 'none',
});
await navigator.serviceWorker.ready;
const worker =
	registration.installing ?? registration.waiting ?? registration.active;
while (worker.state !== 'activated') {
	await new Promise((resolve) =>
		worker.addEventListener('statechange', resolve, { once: true })
	);
}
navigator.serviceWorker.addEventListener('message', (event) => {
	if (event.source !== registration.active || event.data?.scope !== scope)
		return;
	window.parent.postMessage(
		{ ...event.data, type: 'wordpress-bridge-request' },
		appOrigin
	);
});
window.addEventListener('message', (event) => {
	if (
		event.source !== window.parent ||
		event.origin !== appOrigin ||
		event.data?.type !== 'wordpress-bridge-response' ||
		event.data.scope !== scope
	)
		return;
	const { requestId, response } = event.data;
	// Forward body chunks through a new port before sending them across origins again.
	if (response.bodyPort) {
		const source = response.bodyPort;
		const { port1, port2 } = new MessageChannel();
		source.onmessage = (event) => {
			port1.postMessage(event.data);
			if (event.data.t === 'close' || event.data.t === 'error') {
				source.close();
				port1.close();
			}
		};
		port1.onmessage = (event) => source.postMessage(event.data);
		response.bodyPort = port2;
	}
	registration.active.postMessage(
		{ type: 'response', requestId, response },
		response.bodyPort ? [response.bodyPort] : []
	);
});
window.parent.postMessage({ type: 'wordpress-bridge-ready', scope }, appOrigin);
