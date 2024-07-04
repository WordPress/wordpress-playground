// import { logger } from '@php-wasm/logger';
import { isURLScoped } from '@php-wasm/scopes';

export class WorkerCache {
	readonly cacheNamePrefix = 'playground-cache';

	private cacheName: string;

	constructor(cacheVersion: string) {
		this.cacheName = `${this.cacheNamePrefix}-${cacheVersion}`;
	}

	addCache = async (key: Request, response: Response) => {
		const clonedResponse = response.clone();
		const cache = await caches.open(this.cacheName);
		await cache.put(key, clonedResponse);
	};

	getCache = async (key: Request) => {
		const cache = caches.open(this.cacheName);
		return await cache.then((c) => c.match(key, { ignoreSearch: true }));
	};

	isValidHostname = (url: URL) => {
		/**
		 * The development environment uses Vite which doesn't work offline because it dynamically generates assets.
		 * Check the README for offline development instructions.
		 */
		if (
			url.href.startsWith('http://127.0.0.1:5400/') ||
			url.pathname.startsWith('/website-server/')
		) {
			return false;
		}
		if (isURLScoped(url)) {
			return false;
		}
		return ['playground.wordpress.net', '127.0.0.1', 'localhost'].includes(
			url.hostname
		);
	};

	cleanup = async () => {
		const keys = await caches.keys();
		const oldKeys = keys.filter(
			(key) =>
				key.startsWith(this.cacheNamePrefix) && key !== this.cacheName
		);
		return Promise.all(oldKeys.map((key) => caches.delete(key)));
	};

	cachedFetch = async (request: Request): Promise<Response> => {
		const url = new URL(request.url);
		if (!this.isValidHostname(url)) {
			return await fetch(request);
		}
		const cacheKey = request;
		const cache = await this.getCache(cacheKey);
		if (cache) {
			return cache;
		}
		const response = await fetch(request);
		await this.addCache(cacheKey, response);
		return response;
	};

	preCacheResources = async (): Promise<any> => {
		if (!this.isValidHostname(new URL(location.href))) {
			return;
		}

		const cache = await caches.open(this.cacheName);

		// Get the cache manifest and add all the files to the cache
		const manifestResponse = await fetch('/cache-files.json');
		const websiteUrls = await manifestResponse.json();
		return cache.addAll([...websiteUrls, ...['/']]);
	};
}
