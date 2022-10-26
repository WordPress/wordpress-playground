import { registerServiceWorker, startPHPWorkerThread } from 'php-wasm-browser';
import { wasmWorkerUrl, wasmWorkerBackend, serviceWorkerUrl } from "./config";

export async function bootWordPress({ onWasmDownloadProgress }) {
	assertNotInfiniteLoadingLoop();

	const workerThread = await startPHPWorkerThread(
		wasmWorkerBackend,
		wasmWorkerUrl,
		{ onDownloadProgress: onWasmDownloadProgress }
	);
	await registerServiceWorker(serviceWorkerUrl);
	return workerThread;
}

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
			window.parent !== window && window.parent.IS_WASM_WORDPRESS;
	} catch (e) {}
	if (isBrowserInABrowser) {
		throw new Error(
			'The service worker did not load correctly. This is a bug, please report it on https://github.com/WordPress/wordpress-wasm/issues'
		);
	}
	window.IS_WASM_WORDPRESS = true;
}

export const isUploadedFilePath = (path) => {
	return (
		path.startsWith('/wp-content/uploads/') ||
		path.startsWith('/wp-content/plugins/') || (
			path.startsWith('/wp-content/themes/') &&
			!path.startsWith('/wp-content/themes/twentytwentytwo/')
		)
	);
}
