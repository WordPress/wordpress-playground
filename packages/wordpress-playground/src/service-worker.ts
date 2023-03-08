import { awaitReply, getURLScope, removeURLScope } from '@wordpress/php-wasm';
import {
	initializeServiceWorker,
	seemsLikeAPHPServerPath,
	PHPRequest,
	cloneRequest,
	broadcastMessageExpectReply,
} from '@wordpress/php-wasm/build/web/service-worker.js';
import { isUploadedFilePath } from './worker-utils';

// @ts-ignore
initializeServiceWorker({
	// Always use a random version in development to avoid caching issues.
	// In production, use the service worker path as the version – it will always
	// contain the latest hash of the service worker script.
	version: import.meta.env.DEV ? (() => Math.random()) : new URL(import.meta.url).pathname,
	handleRequest(event) {
		const fullUrl = new URL(event.request.url);
		let scope = getURLScope(fullUrl);
		if (!scope) {
			try {
				scope = getURLScope(new URL(event.request.referrer))
			} catch (e) {}
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
				return await PHPRequest(event);
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
		// Direct asset requests
		!resolvedUrl.pathname.startsWith('/assets')
		// Vite dev server requests
		&& !resolvedUrl.pathname.startsWith('/@fs')
	) {
		resolvedUrl.pathname = `/assets/${staticAssetsDirectory}${resolvedUrl.pathname}`;
	}
	return await cloneRequest(request, {
		url: resolvedUrl,
	});
}

async function getScopedWpDetails(scope: string): Promise<WPModuleDetails> {
	if (!scopeToWpModule[scope]) {
		const requestId = await broadcastMessageExpectReply(
			{
				type: 'getWordPressModuleDetails',
			},
			scope
		);
		scopeToWpModule[scope] = await awaitReply(self, requestId);
	}
	return scopeToWpModule[scope];
}
