/**
 * Relay HTTP messages between the WordPress service worker and app-origin PHP.
 *
 * This script runs in a hidden WordPress-origin helper iframe, not in remote.html
 * or the visible WordPress page. Its URL names the app's release directory (or
 * buildVersion in development and portable builds).
 * The service worker can reach this iframe because they share an origin. The
 * iframe can then postMessage() to its app-origin parent. Responses take the same
 * path back, with requestId kept intact so each response resolves the right
 * pending service-worker request.
 *
 * Accept worker messages only from this registration's active worker and scope.
 * Accept responses only from the actual parent window at playgroundOrigin, with
 * that scope. The parent performs the HTTP URL and method checks before calling
 * PHP. No directory handles or general PHP API connection cross this iframe.
 *
 * The document and its release-qualified module URL are served on the WordPress
 * origin. The build supplies playgroundOrigin explicitly. Workers generate helper
 * HTML only for their own buildVersion; other versions reach the server.
 *
 * An older tab keeps using its helper iframe from /releases/A/ even after the
 * service worker updates to B. Both must still agree on message fields (scope,
 * requestId and the bodyPort used to stream a response) while A is supported.
 * RELEASE_HELPER_PROTOCOL_COMPAT: keep these fields compatible with older helpers.
 * PRE_RELEASE_ASSETS_COMPAT: runtimes built before /releases/<id>/ asset URLs
 * omit releaseBase and use app-host paths such as /wp-6.8. Portable builds explicitly
 * use releaseBase: '/'.
 * An incompatible protocol change needs a versioned handshake before deployment.
 */
import { playgroundOrigin } from './config';
import { portToStream, streamToPort } from '@php-wasm/universal';
import { buildVersion } from 'virtual:remote-config';

const scope = new URL(location.href).searchParams.get('scope');
// The host serves /sw.js as a same-origin loader for the app's public worker.
// Keep this URL literal: the service worker also bundles this helper for offline HTML.
const workerUrl = new URL('/sw.js', location.origin);
// PRE_SANDBOX_CDN_COMPAT: introduced by #4526, before release directories, when
// WordPress moved from the app host to wpsandbox.wordpress.net. The CDN could still
// return the old /sw.js that expected WordPress on the app host, breaking HTTP routing.
// Changing the query for each build avoids reusing that CDN URL. updateViaCache
// bypasses the browser's cache only; it cannot bypass a CDN's cached response.
workerUrl.searchParams.set('build-version', buildVersion);
let registration: ServiceWorkerRegistration;
try {
	registration = await navigator.serviceWorker.register(workerUrl, {
		type: 'module',
		updateViaCache: 'none',
	});
	// register() can reuse this loader URL's existing registration without checking
	// its imported app worker. Finish that check before selecting the worker to wait for.
	await registration.update();
} catch (error) {
	// Keep offline startup working with an installed worker, as the app's own
	// worker bootstrap does. Without one, there is no HTTP connection to reuse.
	const installed = await navigator.serviceWorker.getRegistration('/');
	if (!installed?.active) throw error;
	registration = installed;
}
await navigator.serviceWorker.ready;
// ready resolves as soon as any worker is active. While an update installs,
// that can still be the worker installed during a previous visit.
// Wait for the registration's installing/waiting worker to activate before
// telling remote.html that WordPress HTTP requests can reach PHP.
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
