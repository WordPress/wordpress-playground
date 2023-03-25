/// <reference lib="WebWorker" />

declare const self: ServiceWorkerGlobalScope;

import { getURLScope, removeURLScope } from '@php-wasm/scopes';
import {
	awaitReply,
	convertFetchEventToPHPRequest,
	initializeServiceWorker,
	seemsLikeAPHPServerPath,
	cloneRequest,
	broadcastMessageExpectReply,
} from '@php-wasm/web-service-worker';
import { isUploadedFilePath } from './src/lib/is-uploaded-file-path';

// @ts-ignore
import { serviceWorkerVersion } from 'virtual:service-worker-version';
import { Semaphore } from './Semaphore';

if (!(self as any).document) {
	// Workaround: vite translates import.meta.url
	// to document.currentScript which fails inside of
	// a service worker because document is undefined
	// @ts-ignore
	// eslint-disable-next-line no-global-assign
	self.document = {};
}

const CACHE_NAME = 'cache-v1';
const MAX_CONCURRENT_REQUESTS = 15;
const ONE_DAY = 24 * 60 * 60 * 1000; // 1 day in milliseconds
const resourcesToCache =
	/\/(wp-content|wp-admin|wp-includes)\/.*\.(css|js|png|jpg|gif|woff|woff2|ttf|svg)$/;

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then(() => {
			console.debug('[Service Worker] Cache opened');
		})
	);
});

const requestSemaphore = new Semaphore(MAX_CONCURRENT_REQUESTS);

initializeServiceWorker({
	// Always use a random version in development to avoid caching issues.
	// @ts-ignore
	version: import.meta.env.DEV
		? () => Math.random() + ''
		: serviceWorkerVersion,
	handleRequest(event) {
		const fullUrl = new URL(event.request.url);
		let scope = getURLScope(fullUrl);
		if (!scope) {
			try {
				scope = getURLScope(new URL(event.request.referrer));
			} catch (e) {
				// Ignore
			}
		}
		const unscopedUrl = removeURLScope(fullUrl);
		const isReservedUrl = unscopedUrl.pathname.startsWith('/plugin-proxy');
		if (isReservedUrl) {
			return;
		}
		event.preventDefault();
		async function asyncHandler() {
			const { staticAssetsDirectory, defaultTheme } =
				await getScopedWpDetails(scope!);
			if (
				(seemsLikeAPHPServerPath(unscopedUrl.pathname) ||
					isUploadedFilePath(unscopedUrl.pathname)) &&
				!unscopedUrl.pathname.startsWith(
					`/wp-content/themes/${defaultTheme}`
				)
			) {
				const response = await convertFetchEventToPHPRequest(event);
				response.headers.set(
					'Cross-Origin-Resource-Policy',
					'cross-origin'
				);
				response.headers.set(
					'Cross-Origin-Embedder-Policy',
					'credentialless'
				);
				return response;
			}
			const request = await rewriteRequest(
				event.request,
				staticAssetsDirectory
			);

			const cached = await getFromCache(request);
			if (cached) {
				return cached;
			}

			return await fetchAndCache(request);
		}
		return asyncHandler();
	},
});

async function fetchAndCache(request: Request): Promise<Response> {
	await requestSemaphore.acquire();
	try {
		const url = new URL(request.url);
		let networkResponse;
		try {
			networkResponse = await fetch(request);
			// Retry once on failure
			if (networkResponse.status === 403) {
				networkResponse = await fetch(request);
			}
		} catch (e) {
			// Retry once on failure
			networkResponse = await fetch(request);
		}
		
		if (networkResponse.status >= 200 && networkResponse.status < 299 && resourcesToCache.test(url.pathname)) {
			const cache = await caches.open(CACHE_NAME);
			await cache.put(request, networkResponse.clone());
			console.debug('[Service Worker] Resource cached', request.url);
		}

		return networkResponse;
	} finally {
		requestSemaphore.release();
	}
}

async function getFromCache(request: Request): Promise<Response | undefined> {
	const url = new URL(request.url);
	if (resourcesToCache.test(url.pathname)) {
		const cache = await caches.open(CACHE_NAME);
		const cachedResponse = await cache.match(request);

		if (cachedResponse) {
			const now = Date.now();
			const cachedTime = new Date(
				cachedResponse.headers.get('date')!
			).getTime();

			if (now - cachedTime < ONE_DAY) {
				console.debug(
					'[Service Worker] Serving cached resource',
					request.url
				);
				return cachedResponse;
			}
		}
	}
	return;
}

type WPModuleDetails = {
	staticAssetsDirectory: string;
	defaultTheme: string;
};

const scopeToWpModule: Record<string, WPModuleDetails> = {};
async function rewriteRequest(
	request: Request,
	staticAssetsDirectory: string
): Promise<Request> {
	const requestedUrl = new URL(request.url);

	const resolvedUrl = removeURLScope(requestedUrl);
	if (
		// Vite dev server requests
		!resolvedUrl.pathname.startsWith('/@fs') &&
		!resolvedUrl.pathname.startsWith('/assets')
	) {
		resolvedUrl.pathname = `/${staticAssetsDirectory}${resolvedUrl.pathname}`;
	}
	return await cloneRequest(request, {
		url: resolvedUrl,
	});
}

async function getScopedWpDetails(scope: string): Promise<WPModuleDetails> {
	if (!scopeToWpModule[scope]) {
		const requestId = await broadcastMessageExpectReply(
			{
				method: 'getWordPressModuleDetails',
			},
			scope
		);
		scopeToWpModule[scope] = await awaitReply(self, requestId);
	}
	return scopeToWpModule[scope];
}
