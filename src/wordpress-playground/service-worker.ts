import { awaitReply } from '../php-wasm-browser/messaging';
import { getURLScope, removeURLScope } from '../php-wasm-browser/scope';
import {
	initializeServiceWorker,
	seemsLikeAPHPServerPath,
	PHPRequest,
	cloneRequest,
	broadcastMessageExpectReply,
} from '../php-wasm-browser/service-worker/worker-library';
import { isUploadedFilePath } from './worker-utils';
import serviceWorkerVersion from './service-worker-version';

initializeServiceWorker({
	version: serviceWorkerVersion,
	handleRequest(event) {
		const fullUrl = new URL(event.request.url);
		const unscopedUrl = removeURLScope(fullUrl);
		const isReservedUrl = unscopedUrl.pathname.startsWith('/plugin-proxy');
		if (isReservedUrl) {
			return;
		}
		event.preventDefault();
		async function asyncHandler() {
			const { staticAssetsDirectory, defaultTheme } =
				await getScopedWpDetails(getURLScope(fullUrl)!);
			if (
				(seemsLikeAPHPServerPath(unscopedUrl.pathname) ||
					isUploadedFilePath(unscopedUrl.pathname)) &&
				!unscopedUrl.pathname.startsWith(
					`/wp-content/themes/${defaultTheme}`
				)
			) {
				return PHPRequest(event);
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
	resolvedUrl.pathname = `/${staticAssetsDirectory}${resolvedUrl.pathname}`;
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
