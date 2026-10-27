/**
 * Relay HTTP messages between the WordPress service worker and app-origin PHP.
 *
 * This script runs in the hidden, build-keyed WordPress-origin helper iframe,
 * not in remote.html or the visible WordPress page. The service worker can reach
 * this iframe because they share an origin; the iframe can then postMessage() to
 * its app-origin parent. Responses take the same path back, with requestId kept
 * intact so each response resolves the right pending service-worker request.
 *
 * Accept worker messages only from this registration's active worker and scope.
 * Accept responses only from the actual parent window at playgroundOrigin, with
 * that scope. The parent performs the HTTP URL and method checks before calling
 * PHP. No directory handles or general PHP API connection cross this iframe.
 *
 * The document uses the WordPress origin, but this module loads from the app
 * origin. config.ts derives playgroundOrigin from that module URL. On the first
 * load the sandbox build has already pointed the HTML's script URLs at the app
 * (development servers rewrite them on demand). Later the service worker generates
 * the helper HTML with the same app-origin bundle URL for its own build only.
 * Other builds' helper URLs go to the server rather than inheriting stale HTML.
 */
import { playgroundOrigin } from './config';
import { portToStream, streamToPort } from '@php-wasm/universal';

const scope = new URL(location.href).searchParams.get('scope');
// The host serves /sw.js as a same-origin loader for the app's public worker.
// Keep this URL literal: the service worker also bundles this helper for offline HTML.
const registration = await navigator.serviceWorker.register(
	new URL('/sw.js', location.origin),
	{ type: 'module', updateViaCache: 'none' }
);
await navigator.serviceWorker.ready;
// ready can still describe the previous active worker while this build installs.
// Do not announce a working HTTP connection until the replacement has activated.
const worker =
	registration.installing ?? registration.waiting ?? registration.active!;
while (worker.state !== 'activated') {
	if (worker.state === 'redundant')
		throw new Error('The WordPress service worker could not activate.');
	await new Promise<void>((resolve) =>
		worker.addEventListener('statechange', () => resolve(), { once: true })
	);
}

navigator.serviceWorker.addEventListener('message', (event) => {
	if (event.source !== registration.active || event.data?.scope !== scope)
		return;
	window.parent.postMessage(
		{ ...event.data, type: 'wordpress-bridge-request' },
		playgroundOrigin
	);
});
window.addEventListener('message', (event) => {
	if (
		event.source !== window.parent ||
		event.origin !== playgroundOrigin ||
		event.data?.type !== 'wordpress-bridge-response' ||
		event.data.scope !== scope
	)
		return;
	const { requestId, response } = event.data;
	// Rebuild the stream bridge instead of transferring the same port twice.
	// Firefox can lose queued body chunks when the producer closes during that second transfer.
	// https://bugzilla.mozilla.org/show_bug.cgi?id=2077609
	if (response.bodyPort) {
		response.bodyPort = streamToPort(portToStream(response.bodyPort));
	}
	registration.active!.postMessage(
		{ type: 'response', requestId, response },
		response.bodyPort ? [response.bodyPort] : []
	);
});
// Report ready only after worker activation and both listeners are installed.
// The parent waits for this before completing its PHP boot() call.
window.parent.postMessage(
	{ type: 'wordpress-bridge-ready', scope },
	playgroundOrigin
);
