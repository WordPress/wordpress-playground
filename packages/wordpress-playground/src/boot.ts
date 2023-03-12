const origin = new URL('/', import.meta.url).origin;

// @ts-ignore
import moduleWorkerUrl from './worker-thread.ts?worker&url';
// @ts-ignore
import iframeHtmlUrl from '@wordpress/php-wasm/web/iframe-worker.html?url';

export function chooseWorkerThreadBackend() {
	// Firefox doesn't support module workers with dynamic imports,
	// let's fall back to iframe workers.
	// See https://github.com/mdn/content/issues/24402
	const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
	if (isFirefox) {
		const wasmWorkerUrl = new URL(iframeHtmlUrl, origin)
		wasmWorkerUrl.searchParams.set('scriptUrl', moduleWorkerUrl);
		return { backend: 'iframe', url: wasmWorkerUrl };
	} else {
		return { backend: 'webworker', url: new URL(moduleWorkerUrl, origin) };
	}
}

/**
 * When the service worker fails for any reason, the page displayed inside
 * the iframe won't be a WordPress instance we expect from the service worker.
 * Instead, it will be the original page trying to load the service worker. This
 * causes an infinite loop with a loader inside a loader inside a loader.
 */
export function assertNotInfiniteLoadingLoop() {
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
