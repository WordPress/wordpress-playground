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

export const addCache = async (url: string, response: Response) => {
	if (await isCacheFull()) {
		logger.warn('Cache is full, not caching response');
		return;
	}
	try {
		const clonedResponse = response.clone();
		const cache = await caches.open(wpCacheKey);
		await cache.put(url, clonedResponse);
	} catch (e) {
		logger.warn('Failed to cache response', e);
	}
};

export const getCache = async (url: string) => {
	const cache = caches.open(wpCacheKey);
	return await cache.then((c) => c.match(url));
};

export const cachedFetch = async (
	input: RequestInfo | URL,
	init?: RequestInit | undefined
) => {
	const cacheKey = typeof input === 'string' ? input : input.toString();
	const cache = await getCache(cacheKey);
	if (cache) {
		return cache;
	}
	const response = await fetch(input, init);
	await addCache(cacheKey, response);
	return response;
};
