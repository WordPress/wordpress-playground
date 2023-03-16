/// <reference lib="WebWorker" />

declare const self: ServiceWorkerGlobalScope;

import { getURLScope, removeURLScope } from '@wp-playground/php-wasm-scopes';
import {
	awaitReply,
	convertFetchEventToPHPRequest,
	initializeServiceWorker,
	seemsLikeAPHPServerPath,
	cloneRequest,
	broadcastMessageExpectReply,
} from '@wp-playground/php-wasm-web-service-worker';
import { isUploadedFilePath } from './src/lib/is-uploaded-file-path';

if (!(self as any).document) {
	// Workaround: vite translates import.meta.url
	// to document.currentScript which fails inside of 
	// a service worker because document is undefined
	// @ts-ignore
	// eslint-disable-next-line no-global-assign
	self.document = {};
}

// @ts-ignore
initializeServiceWorker({
	// Always use a random version in development to avoid caching issues.
	// In production, use the service worker path as the version – it will always
	// contain the latest hash of the service worker script.
	version: import.meta.env.DEV ? (() => Math.random()+'') : self.location.pathname,
	handleRequest(event) {
		const fullUrl = new URL(event.request.url);
		let scope = getURLScope(fullUrl);
		if (!scope) {
			try {
				scope = getURLScope(new URL(event.request.referrer))
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
				return await convertFetchEventToPHPRequest(event);
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
		!resolvedUrl.pathname.startsWith('/@fs')
		&& !resolvedUrl.pathname.startsWith('/assets')
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
