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

const scopeToWpModule: Record<string, string> = {};
initializeServiceWorker({
	async handleRequest(event) {
		event.preventDefault();
		const url = new URL(event.request.url);
		// When ignoring a scoped request, let's unscope it before
		// passing it to the browser.
		const unscopedUrl = removeURLScope(url);
		const isReservedUrl = unscopedUrl.pathname.startsWith('/plugin-proxy');
		const isPHPPath =
			!isReservedUrl &&
			// @TODO: Check the current default WP theme path
			!unscopedUrl.pathname.startsWith(
				'/wp-content/themes/twentytwentytwo/'
			) &&
			(seemsLikeAPHPServerPath(unscopedUrl.pathname) ||
				isUploadedFilePath(unscopedUrl.pathname));
		if (isPHPPath) {
			return PHPRequest(event);
		}

		if (!isReservedUrl) {
			const scope = getURLScope(url)!;
			if (!scopeToWpModule[scope]) {
				const requestId = await broadcastMessageExpectReply(
					{
						type: 'getWordPressModule',
					},
					scope
				);
				scopeToWpModule[scope] = await awaitReply(self, requestId);
			}

			unscopedUrl.pathname = `/${scopeToWpModule[scope]}${unscopedUrl.pathname}`;
		}
		return fetch(
			await cloneRequest(event.request, {
				url: unscopedUrl,
			})
		);
	},
});
