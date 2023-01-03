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

initializeServiceWorker({
	handleRequest(event) {
		const fullUrl = new URL(event.request.url);
		const unscopedUrl = removeURLScope(fullUrl);
		const isReservedUrl = unscopedUrl.pathname.startsWith('/plugin-proxy');
		if (isReservedUrl) {
			return;
		}
		event.preventDefault();
		const isPHPPath =
			!isReservedUrl &&
			(seemsLikeAPHPServerPath(unscopedUrl.pathname) ||
				isUploadedFilePath(unscopedUrl.pathname));
		if (isPHPPath) {
			return PHPRequest(event);
		}
		return rewriteRequest(event.request).then(fetch);
	},
});

const scopeToWpModule: Record<string, string> = {};
async function rewriteRequest(request: Request): Promise<Request> {
	const requestedUrl = new URL(request.url);

	const scope = getURLScope(requestedUrl)!;
	if (!scopeToWpModule[scope]) {
		const requestId = await broadcastMessageExpectReply(
			{
				type: 'getWordPressModule',
			},
			scope
		);
		scopeToWpModule[scope] = await awaitReply(self, requestId);
	}
	const wpPathPrefix = scopeToWpModule[scope];

	const resolvedUrl = removeURLScope(requestedUrl);
	resolvedUrl.pathname = `${wpPathPrefix}${resolvedUrl.pathname}`;
	return await cloneRequest(request, {
		url: resolvedUrl,
	});
}
