/// <reference lib="WebWorker" />
import { isURLScoped } from '@php-wasm/scopes';
import { cloneRequest } from '@php-wasm/web-service-worker';
import {
	cacheFirstFetch,
	networkFirstFetch,
	fetchBlueprintsIndex,
	cacheOfflineModeAssetsForCurrentRelease,
	shouldCacheUrl,
} from './offline-mode-cache';
import { getReleaseRoot } from '@wp-playground/common';
import { wordPressSiteUrl, playgroundOrigin } from './config';

declare const self: ServiceWorkerGlobalScope;
const clientReleases = new Map<string, string>();
const releaseRegistry = 'playground-client-releases';

/** App routing deliberately has no handler capable of executing WordPress HTML. */
export function installAppServiceWorker() {
	const sharedMode =
		new URL(self.location.href).searchParams.get('shared-worker') === '1';
	self.addEventListener('activate', (event) => {
		if (
			!new URL(self.location.href).searchParams.has('release') &&
			wordPressSiteUrl === playgroundOrigin
		) {
			event.waitUntil(
				cacheOfflineModeAssetsForCurrentRelease(
					sharedMode ? ['/personal-wp-version.json'] : []
				)
			);
		}
	});
	self.addEventListener('message', (event) => {
		if (event.data?.type !== 'playground-pin-release') return;
		const source = event.source as Client | null;
		const root = getReleaseRoot(
			new URL(event.data.root, self.location.origin)
		);
		if (!source?.id || !root || root.origin !== self.location.origin)
			return;
		event.waitUntil(
			pinRelease(source.id, root.pathname).then(() => {
				event.ports[0]?.postMessage({
					protocol: 1,
					root: root.pathname,
				});
			})
		);
	});
	self.addEventListener('fetch', (event) => {
		const url = new URL(event.request.url);
		if (url.origin !== self.location.origin) return;
		if (isURLScoped(url)) {
			if (wordPressSiteUrl !== playgroundOrigin) {
				event.respondWith(new Response('Not found', { status: 404 }));
			}
			return;
		}
		if (
			/^\/(?:app|sandbox)-sw-/.test(url.pathname) ||
			url.pathname === '/sw.js' ||
			url.pathname.endsWith('.php') ||
			url.pathname.startsWith('/plugin-proxy') ||
			url.pathname.startsWith('/relay/') ||
			url.pathname.startsWith('/@fs/') ||
			(sharedMode && url.pathname.endsWith('/personal-wp-version.json'))
		)
			return;
		if (url.pathname === '/blueprints-index.json') {
			event.respondWith(fetchBlueprintsIndex());
			return;
		}
		if (url.pathname.startsWith('/proxy/')) {
			event.respondWith(new Response('Not found', { status: 404 }));
			return;
		}
		if (!shouldCacheUrl(url)) return;
		// Stable entry points always reach the bootstrap so each new document checks the selector.
		if (
			[
				'/',
				'/index.html',
				'/remote.html',
				'/api.html',
				'/bootstrap.js',
			].includes(url.pathname) ||
			(sharedMode &&
				(event.request.mode === 'navigate' ||
					url.pathname.endsWith('/shared-playground-worker.js')))
		) {
			event.respondWith(networkFirstFetch(event.request));
			return;
		}
		event.respondWith(fetchAppAsset(event));
	});
}

async function pinRelease(clientId: string, root: string) {
	clientReleases.set(clientId, root);
	const registry = await caches.open(releaseRegistry);
	await registry.put(
		new URL(`/__client-release/${clientId}`, self.location.origin),
		new Response(root)
	);
}

async function fetchAppAsset(event: FetchEvent): Promise<Response> {
	let request = event.request;
	const url = new URL(request.url);
	if (!getReleaseRoot(url)) {
		let root = clientReleases.get(event.clientId);
		if (!root && event.clientId) {
			const client = await self.clients.get(event.clientId);
			root = client
				? getReleaseRoot(new URL(client.url))?.pathname
				: undefined;
			if (!root) {
				const registry = await caches.open(releaseRegistry);
				root = await (
					await registry.match(
						new URL(
							`/__client-release/${event.clientId}`,
							self.location.origin
						)
					)
				)?.text();
			}
		}
		if (root) {
			const target = new URL(
				`.${url.pathname}${url.search}`,
				new URL(root, url)
			);
			request = await cloneRequest(request, { url: target });
		}
	}
	if (/^bytes=[1-9]\d*-$/.test(request.headers.get('range') ?? ''))
		return fetch(request);
	return cacheFirstFetch(request);
}
