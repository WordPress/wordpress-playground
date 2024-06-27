// import { logger } from '@php-wasm/logger';
import { isURLScoped } from '@php-wasm/scopes';

const wpCacheKey = 'playground-cache';

const isCacheFull = async () => {
	if (navigator.storage && navigator.storage.estimate) {
		const estimatedStorage = await navigator.storage.estimate();
		if (estimatedStorage.usage && estimatedStorage.quota) {
			return estimatedStorage.usage >= estimatedStorage.quota;
		}
	}
	return false;
};

export const addCache = async (key: string, response: Response) => {
	if (await isCacheFull()) {
		console.warn('Cache is full, not caching response');
		return;
	}
	try {
		const clonedResponse = response.clone();
		const cache = await caches.open(wpCacheKey);
		await cache.put(key, clonedResponse);
	} catch (e) {
		console.warn('Failed to cache response', e);
	}
};

export const getCache = async (key: string) => {
	const cache = caches.open(wpCacheKey);
	return await cache.then((c) => c.match(key));
};

const validHostnames = ['playground.wordpress.net', '127.0.0.1', 'localhost'];

const isValidHostname = (url: URL) => {
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
	return validHostnames.includes(url.hostname);
};

export const cachedFetch = async (request: Request): Promise<Response> => {
	const url = new URL(request.url);
	if (!isValidHostname(url)) {
		return await fetch(request);
	}
	const cacheKey = url.href;
	const cache = await getCache(cacheKey);
	if (cache) {
		return cache;
	}
	const response = await fetch(request);
	await addCache(cacheKey, response);
	return response;
};

const preCachedResources: RequestInfo[] = ['/', '/index.html', '/sw.js'];

export const preCacheResources = async (): Promise<any> => {
	if (!isValidHostname(new URL(location.href))) {
		return;
	}
	return caches
		.open(wpCacheKey)
		.then((cache) => cache.addAll(preCachedResources));
};
