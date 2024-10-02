import { isURLScoped } from '@php-wasm/scopes';
import { fetchFresh } from '@php-wasm/web-service-worker';
// @ts-ignore
import { buildVersion } from 'virtual:remote-config';

const CACHE_NAME_PREFIX = 'playground-cache';
const LATEST_CACHE_NAME = `${CACHE_NAME_PREFIX}-${buildVersion}`;

// We save a top-level Promise because this module is imported by
// a Service Worker module which does not allow top-level await.
const promisedOfflineModeCache = caches.open(LATEST_CACHE_NAME);

export async function cachedFetch(request: Request): Promise<Response> {
	if (!shouldCacheUrl(new URL(request.url))) {
		return await fetch(request);
	}

	const offlineModeCache = await promisedOfflineModeCache;
	let response = await offlineModeCache.match(request, {
		ignoreSearch: true,
	});
	if (!response) {
		response = await fetchFresh(request);
		if (response.ok) {
			//@ts-ignore
			if (self.serviceWorker.state === 'activated') {
				await offlineModeCache.put(request, response.clone());
			}
		}
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
	if (!shouldCacheUrl(new URL(location.href))) {
		return;
	}

	// Get the cache manifest and add all the files to the cache
	const manifestResponse = await fetch(
		'/assets-required-for-offline-mode.json',
		{ cache: 'no-store' }
	);
	const requiredOfflineAssetUrls = await manifestResponse.json();
	const urlsToCache = ['/', ...requiredOfflineAssetUrls];
	const websiteRequests = urlsToCache.map(
		// TODO: Explain why no caching
		(url: string) => new Request(url, { cache: 'no-cache' })
	);
	const offlineModeCache = await promisedOfflineModeCache;
	await offlineModeCache.addAll([...websiteRequests, ...['/']]);
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
	// @TODO: Ensure an older service worker won't ever remove the assets of a newer service worker,
	//        even if this is accidentally called in the older worker.
	const keys = await caches.keys();
	const oldKeys = keys.filter(
		(key) => key.startsWith(CACHE_NAME_PREFIX) && key !== LATEST_CACHE_NAME
	);
	const promisesToPurgeOldCaches = oldKeys.map(async (oldKey) => {
		const oldCache = await caches.open(oldKey);
		await caches.delete(oldKey);

		// We delete individual cached entries so references to the deleted
		// cache can no longer access stale data.
		const oldCacheKeys = await oldCache.keys();
		return Promise.all(oldCacheKeys.map((entry) => oldCache.delete(entry)));
	});
	return Promise.all(promisesToPurgeOldCaches);
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

function shouldCacheUrl(url: URL) {
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
		url.href.startsWith('https://playground.test/') ||
		url.pathname.startsWith('/website-server/')
	) {
		return false;
	}

	/**
	 * Scoped URLs are requests made to the PHP Worker Thread.
	 * These requests are not cached because they are not static assets.
	 */
	if (isURLScoped(url)) {
		return false;
	}

	/**
	 * Don't cache PHP files because they are dynamic.
	 */
	if (url.pathname.endsWith('.php')) {
		return false;
	}

	/**
	 * Allow only requests to the same hostname to be cached.
	 */
	return self.location.hostname === url.hostname;
}
