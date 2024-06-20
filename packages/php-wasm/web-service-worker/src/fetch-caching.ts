import { logger } from '@php-wasm/logger';
import { decodeZip } from '@php-wasm/stream-compression';

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
	if (url.pathname.startsWith('/website-server/@')) {
		return false;
	}
	if (url.href.includes('?html-proxy')) {
		return false;
	}
	return validHostnames.includes(url.hostname);
};

export const cachedFetch = async (request: Request): Promise<Response> => {
	const url = new URL(request.url);
	if (!isValidHostname(url)) {
		try {
			return await fetch(request);
		} catch (e) {
			logger.warn('Failed to fetch', request.url, e);
			return new Response('Failed to fetch', { status: 500 });
		}
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

const precachedResources: RequestInfo[] = [
	'/website-server/',
	'/website-server/index.html',
];

export const precacheResources = async (): Promise<any> => {
	return caches
		.open(wpCacheKey)
		.then((cache) => cache.addAll(precachedResources));
};

export const preloadStaticAssets = async () => {
	cachedFetch(
		new Request('/wp-nightly/wordpress-static.zip', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/zip',
			},
		})
	).then(async (response) => {
		const zipBytes = await response.arrayBuffer();
		const zipStream = decodeZip(new Blob([zipBytes]).stream());
		const files = [];
		for await (const file of zipStream) {
			files.push(file);
		}
		for (const file of files) {
			const url = new URL(
				file.name.replace('/wordpress-static', ''),
				self.location.origin
			);
			const content = new Uint8Array(await file.arrayBuffer());
			addCache(url.pathname, new Response(content));
		}
	});
};
