/// <reference lib="WebWorker" />

declare const self: ServiceWorkerGlobalScope;

import { getURLScope, removeURLScope } from '@php-wasm/scopes';
import {
	awaitReply,
	convertFetchEventToPHPRequest,
	initializeServiceWorker,
	seemsLikeAPHPRequestHandlerPath,
	cloneRequest,
	broadcastMessageExpectReply,
} from '@php-wasm/web-service-worker';
import { isUploadedFilePath } from './src/lib/is-uploaded-file-path';

// @ts-ignore
import { serviceWorkerVersion } from 'virtual:service-worker-version';

if (!(self as any).document) {
	// Workaround: vite translates import.meta.url
	// to document.currentScript which fails inside of
	// a service worker because document is undefined
	// @ts-ignore
	// eslint-disable-next-line no-global-assign
	self.document = {};
}

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
				(seemsLikeAPHPRequestHandlerPath(unscopedUrl.pathname) ||
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
			return fetch(request);
		}
		return asyncHandler();
	},
});

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
