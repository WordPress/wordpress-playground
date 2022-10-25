import {
	postMessageExpectReply,
	awaitReply,
    responseTo,
    registerServiceWorker,
    startPHPWorkerThread,
	getWorkerThreadFrontend	
} from 'php-wasm-browser';

import {
    wasmWorkerUrl,
    wasmWorkerBackend,
    wordPressSiteUrl,
    serviceWorkerUrl,
} from "./config";
  
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const noop = () => {};

export async function bootWordPress({
	assignScope = true,
	onWasmDownloadProgress,
}) {
	assertNotInfiniteLoadingLoop();

	const scope = assignScope ? Math.random().toFixed(16) : undefined;

	const workerThread = await startPHPWorkerThread({
		frontend: getWorkerThreadFrontend(wasmWorkerBackend, wasmWorkerUrl),
		absoluteUrl: wordPressSiteUrl,
		scope,
		onDownloadProgress: onWasmDownloadProgress,
	});
	await registerServiceWorker({
		url: serviceWorkerUrl,
		broadcastChannel: new BroadcastChannel('wordpress-wasm'),
		// Forward any HTTP requests to a worker to resolve them in another process.
		// This way they won't slow down the UI interactions.
		onRequest: async (request) => {
			return await workerThread.HTTPRequest(request);
		},
		scope,
	});
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
