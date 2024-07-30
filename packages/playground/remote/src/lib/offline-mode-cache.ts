import { isURLScoped } from '@php-wasm/scopes';
// @ts-ignore
import { buildVersion } from 'virtual:remote-config';

const CACHE_NAME_PREFIX = 'playground-cache';
const LATEST_CACHE_NAME = `${CACHE_NAME_PREFIX}-${buildVersion}`;

export class OfflineModeCache {
	public cache: Cache;
	private hostname = self.location.hostname;

	private static instance?: OfflineModeCache;

	static async getInstance() {
		if (!OfflineModeCache.instance) {
			const cache = await caches.open(LATEST_CACHE_NAME);
			OfflineModeCache.instance = new OfflineModeCache(cache);
		}
		return OfflineModeCache.instance;
	}

	private constructor(cache: Cache) {
		this.cache = cache;
	}

	async removeOutdatedFiles() {
		const keys = await caches.keys();
		const oldKeys = keys.filter(
			(key) =>
				key.startsWith(CACHE_NAME_PREFIX) && key !== LATEST_CACHE_NAME
		);
		return Promise.all(oldKeys.map((key) => caches.delete(key)));
	}

	async cachedFetch(request: Request): Promise<Response> {
		if (!this.shouldCacheUrl(new URL(request.url))) {
			return await fetch(request);
		}

		let response = await this.cache.match(request, { ignoreSearch: true });
		if (!response) {
			response = await fetch(request);
			if (response.ok) {
				await this.cache.put(request, response.clone());
			}
		}

		return response;
	}

	async cacheOfflineModeAssets(): Promise<any> {
		if (!this.shouldCacheUrl(new URL(location.href))) {
			return;
		}

		const manifestResponse = await fetch(
			'/assets-required-for-offline-mode.json'
		);
		const websiteUrls = await manifestResponse.json();
		await this.cache.addAll([...websiteUrls, ...['/']]);
	}

	private shouldCacheUrl(url: URL) {
		if (url.href.includes('wordpress-static.zip')) {
			return true;
		}
		/**
		 * The development environment uses Vite which doesn't work offline because it dynamically generates assets.
		 * Check the README for offline development instructions.
		 */
		// @ts-ignore-next-line
		if (import.meta.env.MODE === 'development') {
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
		return this.hostname === url.hostname;
	}
}
