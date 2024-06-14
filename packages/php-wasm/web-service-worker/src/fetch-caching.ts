import { logger } from '@php-wasm/logger';

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
		logger.warn('Cache is full, not caching response');
		return;
	}
	try {
		const clonedResponse = response.clone();
		const cache = await caches.open(wpCacheKey);
		await cache.put(key, clonedResponse);
	} catch (e) {
		logger.warn('Failed to cache response', e);
	}
};

export const getCache = async (key: string) => {
	const cache = caches.open(wpCacheKey);
	return await cache.then((c) => c.match(key));
};

const validHostnames = ['playground.wordpress.net', '127.0.0.1', 'localhost'];

const isValidHostname = (url: URL) => {
	return validHostnames.includes(url.hostname);
};

export const cachedFetch = async (request: Request): Promise<Response> => {
	const url = new URL(request.url);
	if (!isValidHostname(url)) {
		return fetch(request);
	}
	const cacheKey = url.pathname;
	const cache = await getCache(cacheKey);
	if (cache) {
		return cache;
	}
	const response = await fetch(request);
	await addCache(cacheKey, response);
	return response;
};

const precachedResources: RequestInfo[] = [
	'/website-server/',
	'/website-server/index.html',
];

export const precacheResources = async (): Promise<any> => {
	return caches
		.open(wpCacheKey)
		.then((cache) => cache.addAll(precachedResources));
};
