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
window.parent.postMessage(
	{ type: 'wordpress-bridge-ready', scope },
	playgroundOrigin
);
