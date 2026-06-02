import { isURLScoped } from '@php-wasm/scopes';
// @ts-ignore
import { buildVersion } from 'virtual:remote-config';

const CACHE_NAME_PREFIX = 'playground-cache';
const LATEST_CACHE_NAME = `${CACHE_NAME_PREFIX}-${buildVersion}`;

// We save a top-level Promise because this module is imported by
// a Service Worker module which does not allow top-level await.
const promisedOfflineModeCache = caches.open(LATEST_CACHE_NAME);

export async function cacheFirstFetch(request: Request): Promise<Response> {
	const offlineModeCache = await promisedOfflineModeCache;
	const cachedResponse = await offlineModeCache.match(request, {
		ignoreSearch: true,
	});
	if (cachedResponse) {
		return cachedResponse;
	}

	/**
	 * Strip the Range header if present. Safari sometimes adds Range headers
	 * to requests, which results in 206 Partial Content responses that can't
	 * be cached using .put() since they're incomplete responses.
	 */
	const requestWithoutRangeHeader = stripRangeHeader(request);

	/**
	 * Ensure the response is not coming from HTTP cache.
	 *
	 * We never want to put a stale asset in CacheStorage as
	 * that would break Playground.
	 *
	 * See service-worker.ts for more details.
	 */
	const response = await fetchFresh(requestWithoutRangeHeader);
	if (response.ok) {
		/**
		 * Confirm the current service worker is still active
		 * when the asset is fetched. Caching a stale request
		 * from a stale worker has no benefits. It only takes
		 * up space.
		 */
		if (
			isCurrentServiceWorkerActive() &&
			['GET', 'HEAD'].includes(request.method)
		) {
			// Intentionally do not await writing to the cache so the response
			// promise can be returned immediately and observed for progress events.
			// NOTE: This is a race condition for simultaneous requests for the same asset.
			offlineModeCache.put(requestWithoutRangeHeader, response.clone());
		}
	}

	return response;
}

export async function networkFirstFetch(request: Request): Promise<Response> {
	const offlineModeCache = await promisedOfflineModeCache;
	const cachedResponse = await offlineModeCache.match(request, {
		ignoreSearch: true,
	});

	let response: Response | undefined = undefined;
	try {
		/**
		 * Only use either `no-store` or `reload` here or else Playground won't
		 * load in Safari after a new version is deployed.
		 *
		 * Initially, we used `no-cache` here:
		 * * Chrome and Firefox did not source the /index.html file from the HTTP cache.
		 * * Safari still sourced the /index.html file from the HTTP cache.
		 *
		 * After a new Playground deployment, the stale cached index.html contained
		 * references to assets that were no longer available on the server.
		 *
		 * The `cache: no-store` option actually makes Safari behave as expected, that is
		 * go to the network without loading the stale HTTP cache response.
		 */
		response = await fetch(request, {
			cache: 'no-store',
		});
	} catch (e) {
		if (cachedResponse) {
			return cachedResponse;
		}
		throw e;
	}

	if (response.ok) {
		// Intentionally do not await writing to the cache so the response
		// promise can be returned immediately and observed for progress events.
		// NOTE: This is a race condition for simultaneous requests for the same asset.
		offlineModeCache.put(request, response.clone());
		return response;
	}

	if (cachedResponse) {
		return cachedResponse;
	}

	return response;
}

/**
 * For offline mode to work we need to cache all required assets.
 *
 * These assets are listed in the `/assets-required-for-offline-mode.json`
 * file and contain JavaScript, CSS, and other assets required to load the
 * site without making any network requests.
 */
export async function cacheOfflineModeAssetsForCurrentRelease(): Promise<any> {
	// Get the cache manifest and add all the files to the cache
	const manifestResponse = await fetchFresh(
		'/assets-required-for-offline-mode.json'
	);
	const requiredOfflineAssetUrls = await manifestResponse.json();
	const urlsToCache = ['/', ...requiredOfflineAssetUrls];
	const websiteRequests = urlsToCache.map(
		/**
		 * Ensure the response is not coming from HTTP cache.
		 *
		 * If it did, we'd risk mixing assets from different
		 * Playground builds and breaking the site.
		 *
		 * See service-worker.ts for more details.
		 */
		(url: string) =>
			new Request(url, {
				// Do not use no-cache here. See the comment in networkFirstFetch() for more details.
				cache: 'no-store',
			})
	);
	const offlineModeCache = await promisedOfflineModeCache;
	await offlineModeCache.addAll(websiteRequests);
}

/**
 * Remove outdated files from the cache.
 *
 * We cache data based on `buildVersion` which is updated whenever Playground
 * is built. So when a new version of Playground is deployed, the service
 * worker will remove the old cache and cache the new assets.
 *
 * If your build version doesn't change while developing locally check
 * `buildVersionPlugin` for more details on how it's generated.
 */
export async function purgeEverythingFromPreviousRelease() {
	const keys = await caches.keys();
	const oldKeys = keys.filter(
		(key) => key.startsWith(CACHE_NAME_PREFIX) && key !== LATEST_CACHE_NAME
	);
	return Promise.all(oldKeys.map((key) => caches.delete(key)));
}

/**
 * Answers whether a given URL has a response in the offline mode cache.
 * Ignores the search part of the URL by default.
 */
export async function hasCachedResponse(
	url: string,
	queryOptions: CacheQueryOptions = { ignoreSearch: true }
): Promise<boolean> {
	const offlineModeCache = await promisedOfflineModeCache;
	const cachedResponse = await offlineModeCache.match(url, queryOptions);
	return !!cachedResponse;
}

export function shouldCacheUrl(url: URL) {
	if (url.href.includes('wordpress-static.zip')) {
		return true;
	}
	/**
	 * The development environment uses Vite which doesn't work offline because
	 * it dynamically generates assets. Check the README for offline development
	 * instructions.
	 */
	if (
		url.href.startsWith('http://127.0.0.1:5400/') ||
		url.href.startsWith('http://localhost:5400/') ||
		url.href.startsWith('http://127.0.0.1:5401/') ||
		url.href.startsWith('http://localhost:5401/') ||
		url.href.startsWith('https://playground.test/') ||
		url.pathname.startsWith('/website-server/')
	) {
		return false;
	}

	/**
	 * Don't cache scoped requests made to the PHP Worker Thread.
	 * They may be static assets, but they may also be PHP files.
	 * We can't tell by the URL, e.g. `/sitemap.xml` can be both.
	 */
	if (isURLScoped(url)) {
		return false;
	}

	/**
	 * Don't cache responses generated by PHP files – they may
	 * change on every request.
	 */
	if (url.pathname.endsWith('.php')) {
		return false;
	}

	/**
	 * Allow only requests to the same hostname to be cached.
	 */
	return self.location.hostname === url.hostname;
}

/**
 * Removes the Range header from a request if present.
 *
 * Safari sometimes adds Range headers which cause 206 Partial Content responses
 * that can't be cached using Cache API's .put() method.
 *
 * @param request The original request
 * @returns A new request without the Range header
 */
function stripRangeHeader(request: Request): Request {
	if (!request.headers.has('range')) {
		return request;
	}

	const headers = new Headers(request.headers);
	headers.delete('range');

	return new Request(request, { headers });
}

/**
 * Fetches a resource and avoids stale responses from browser cache.
 *
 * @param resource The resource to fetch.
 * @param init     Optional object containing custom settings.
 * @returns Promise<Response>
 */
function fetchFresh(resource: RequestInfo | URL, init?: RequestInit) {
	return fetch(resource, {
		...init,
		// Do not use no-cache here. See the comment in networkFirstFetch() for more details.
		cache: 'no-store',
	});
}

export function isCurrentServiceWorkerActive() {
	// @ts-ignore
	// Firefox doesn't support serviceWorker.state
	if (!('serviceWorker' in self) || !('state' in self.serviceWorker)) {
		return true;
	}
	// @ts-ignore
	return self.serviceWorker.state === 'activated';
}
