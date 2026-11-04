/// <reference lib="WebWorker" />
import { playgroundOrigin, wordPressSiteUrl } from './config';
// @ts-ignore -- Supplied by Vite.
import { buildVersion } from 'virtual:remote-config';

declare const self: ServiceWorkerGlobalScope;

/** Reject the wrong worker before installation can replace an existing registration. */
export function installWorkerLifecycle(role: 'app' | 'sandbox') {
	const expectedOrigin = role === 'app' ? playgroundOrigin : wordPressSiteUrl;
	if (
		self.location.origin !== expectedOrigin ||
		(role === 'sandbox' && wordPressSiteUrl === playgroundOrigin)
	) {
		throw new Error(
			`The ${role} service worker cannot run on this origin.`
		);
	}
	self.addEventListener('install', (event) =>
		event.waitUntil(self.skipWaiting())
	);
	self.addEventListener('activate', (event) =>
		event.waitUntil(self.clients.claim())
	);
	self.addEventListener('message', (event) => {
		if (event.data?.type !== 'playground-worker-status') return;
		event.ports[0]?.postMessage({
			protocol: 1,
			role,
			buildVersion,
			release: self.location.search
				? new URL(self.location.href).searchParams.get('release')
				: undefined,
		});
	});
}
