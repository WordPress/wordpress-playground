import {
	exposeAPI,
	registerServiceWorker,
	spawnPHPWorkerThread,
	consumeAPI,
} from '@wordpress/php-wasm';

import type { InternalWorkerAPI } from './worker-thread';

const origin = new URL('/', import.meta.url).origin;

// @ts-ignore
import moduleWorkerUrl from './worker-thread.ts?worker&url';
// @ts-ignore
import iframeHtmlUrl from '@wordpress/php-wasm/web/iframe-worker.html?url';

import { recommendedWorkerBackend } from '@wordpress/php-wasm';

export const workerBackend = recommendedWorkerBackend;
export const workerUrl: string = (function () {
	switch (workerBackend) {
		case 'webworker':
			return new URL(moduleWorkerUrl, origin)+'';
		case 'iframe': {
			const wasmWorkerUrl = new URL(iframeHtmlUrl, origin);
			wasmWorkerUrl.searchParams.set('scriptUrl', moduleWorkerUrl);
			return wasmWorkerUrl+'';
		}
		default:
			throw new Error(`Unknown backend: ${workerBackend}`);
	}
})();

// @ts-ignore
import serviceWorkerPath from './service-worker.ts?worker&url';
export const serviceWorkerUrl = new URL(serviceWorkerPath, origin);

assertNotInfiniteLoadingLoop();

const query = new URL(document.location.href).searchParams as any;
const wpVersion = query.get('wp') ? query.get('wp') : '6.1';
const phpVersion = query.get('php') ? query.get('php') : '8.0';
const internalApi = consumeAPI<InternalWorkerAPI>(
	spawnPHPWorkerThread(workerUrl, workerBackend, {
		// Vite doesn't deal well with the dot in the parameters name,
		// passed to the worker via a query string, so we replace
		// it with an underscore
		wpVersion: wpVersion.replace('.', '_'),
		phpVersion: phpVersion.replace('.', '_'),
	})
);

const wpFrame = document.querySelector('#wp') as HTMLIFrameElement;

// If onDownloadProgress is not explicitly re-exposed here,
// Comlink will throw an error and claim the callback
// cannot be cloned. Adding a transfer handler for functions
// doesn't help:
// https://github.com/GoogleChromeLabs/comlink/issues/426#issuecomment-578401454
// @TODO: Handle the callback conversion automatically and don't explicitly re-expose
//        the onDownloadProgress method
const [setAPIReady, playground] = exposeAPI(
	{
		async onDownloadProgress(fn) {
			return internalApi.onDownloadProgress(fn)
		},
		async onNavigation(fn) {
			// Manage the address bar
			wpFrame.addEventListener('load', async (e: any) => {
				const path = await playground.internalUrlToPath(
					e.currentTarget!.contentWindow.location.href
				);
				fn(path);
			});
		},
		async goTo(requestedPath: string) {
			wpFrame.src = await playground.pathToInternalUrl(requestedPath);
		},
		async getCurrentURL() {
			return await playground.internalUrlToPath(wpFrame.src);
		},
		async setIframeSandboxFlags(flags: string[]) {
			wpFrame.setAttribute("sandbox", flags.join(" "));
		}
	},
	internalApi
);

await internalApi.isReady();
await registerServiceWorker(
	internalApi,
	await internalApi.scope,
	serviceWorkerUrl + '',
	// @TODO: source the hash of the service worker file in here
	serviceWorkerUrl.pathname
);
wpFrame.src = await playground.pathToInternalUrl('/');

setAPIReady();

export type PlaygroundAPI = typeof playground;

/**
 * When the service worker fails for any reason, the page displayed inside
 * the iframe won't be a WordPress instance we expect from the service worker.
 * Instead, it will be the original page trying to load the service worker. This
 * causes an infinite loop with a loader inside a loader inside a loader.
 */
function assertNotInfiniteLoadingLoop() {
	let isBrowserInABrowser = false;
	try {
		isBrowserInABrowser =
			window.parent !== window &&
			(window as any).parent.IS_WASM_WORDPRESS;
	} catch (e) {}
	if (isBrowserInABrowser) {
		throw new Error(
			'The service worker did not load correctly. This is a bug, please report it on https://github.com/WordPress/wordpress-playground/issues'
		);
	}
	(window as any).IS_WASM_WORDPRESS = true;
}
