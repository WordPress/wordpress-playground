import { logger } from '@php-wasm/logger';

const wpCacheKey = 'playground-cache';

const validCacheFiles = [
	/wp-\d+\.\d+(\.\d+)?(-.*)?\.zip$/,
	/php_\d+_\d+(_\d+)?(-.*)?\.wasm$/,
	/sqlite-database-integration(-.*)?\.zip$/,
];

export const isValidFile = (key: string) => {
	return validCacheFiles.some((pattern) => key.match(pattern));
};

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

export const cleanOutdatedCachedFile = async (key: string) => {
	const cache = await caches.open(wpCacheKey);
	const cacheKeys = await cache.keys();

	if (!isValidFile(key)) {
		return;
	}

	const outdatedKeys = cacheKeys.filter((cacheKey) =>
		validCacheFiles.some(
			// Check if the cache key and the key match the same pattern to prevent deleting unrelated cache entries
			(pattern) => cacheKey.url.match(pattern) && key.match(pattern)
		)
	);

	await Promise.all(outdatedKeys.map((key) => cache.delete(key)));
};

export const cachedFetch = async (
	input: RequestInfo | URL,
	init?: RequestInit | undefined
) => {
	const cacheKey = typeof input === 'string' ? input : input.toString();

	const fetchPromise = fetch(input, init);
	if (!isValidFile(cacheKey)) {
		return await fetchPromise;
	}

	const cache = await getCache(cacheKey);
	if (cache) {
		return cache;
	}
	const response = await fetchPromise;

	await cleanOutdatedCachedFile(cacheKey);
	await addCache(cacheKey, response);
	return response;
};
