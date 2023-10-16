/// <reference lib="WebWorker" />

declare const self: ServiceWorkerGlobalScope;

import { getURLScope, removeURLScope } from '@php-wasm/scopes';
import {
	awaitReply,
	convertFetchEventToPHPRequest,
	initializeServiceWorker,
	cloneRequest,
	broadcastMessageExpectReply,
} from '@php-wasm/web-service-worker';

if (!(self as any).document) {
	// Workaround: vite translates import.meta.url
	// to document.currentScript which fails inside of
	// a service worker because document is undefined
	// @ts-ignore
	// eslint-disable-next-line no-global-assign
	self.document = {};
}

initializeServiceWorker({
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
			const { staticAssetsDirectory } = await getScopedWpDetails(scope!);
			const workerResponse = await convertFetchEventToPHPRequest(event);
			if (
				workerResponse.status === 404 &&
				workerResponse.headers.get('x-file-type') === 'static'
			) {
				// If we get a 404 for a static file, try to fetch it from
				// the from the static assets directory at the remote server.
				const request = await rewriteRequest(
					event.request,
					staticAssetsDirectory
				);
				return fetch(request);
			}
			return workerResponse;
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
