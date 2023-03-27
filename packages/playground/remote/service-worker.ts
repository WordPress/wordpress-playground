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

import {
	serviceWorkerVersion,
	fetchRateLimiting,
} from 'virtual:service-worker-config';
import Semaphore from './src/lib/Semaphore';

if (!(self as any).document) {
	// Workaround: vite translates import.meta.url
	// to document.currentScript which fails inside of
	// a service worker because document is undefined
	// @ts-ignore
	// eslint-disable-next-line no-global-assign
	self.document = {};
}

const fetchHandler = fetchRateLimiting ? fetchRateLimited : fetch;

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
			return await fetchHandler(request);
		}
		return asyncHandler();
	},
});

// Rate-limiting:
const requestSemaphore = new Semaphore({
	concurrency: 20,
	requestsPerInterval: 35,
	intervalMs: 1000,
});

async function fetchRateLimited(request: Request) {
	const release = await requestSemaphore.acquire();
	try {
		let response;
		try {
			response = await fetch(request.clone());
		} catch (e) {
			// Network error – sometimes happens due to
			// rate-limiting. Let's wait a moment and
			// retry the request once.
			await sleep(300);
			response = await fetch(request.clone());
		}
		if (response.status === 403) {
			// If the request was forbidden, it might be because the
			// request was rate-limited. So we'll wait a bit and retry
			// the request one last time.
			await sleep(300);
			response = await fetch(request.clone());
		}
		return response;
	} finally {
		release();
	}
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

async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
