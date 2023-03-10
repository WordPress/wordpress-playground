import {
	registerServiceWorker,
	spawnPHPWorkerThread,
	SpawnedWorkerThread,
	DownloadProgressCallback,
} from '@wordpress/php-wasm';

const origin = new URL('/', import.meta.url).origin;
// @ts-ignore
import serviceWorkerPath from './service-worker.ts?worker&url';
const serviceWorkerUrl = new URL(serviceWorkerPath, origin)

// @ts-ignore
import moduleWorkerUrl from './worker-thread.ts?worker&url';
// @ts-ignore
import iframeHtmlUrl from '@wordpress/php-wasm/web/iframe-worker.html?url';

export async function bootWordPress(
	config: BootConfiguration
): Promise<SpawnedWorkerThread> {
	const { onWasmDownloadProgress } = config;
	assertNotInfiniteLoadingLoop();

	// Firefox doesn't support module workers with dynamic imports,
	// let's fall back to iframe workers.
	// See https://github.com/mdn/content/issues/24402
	const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
	let wasmWorkerBackend;
	let wasmWorkerUrl;
	if (isFirefox) {
		wasmWorkerBackend = 'iframe';
		wasmWorkerUrl = new URL(iframeHtmlUrl, origin)
		wasmWorkerUrl.searchParams.set('scriptUrl', moduleWorkerUrl);
	} else {
		wasmWorkerBackend = 'webworker';
		wasmWorkerUrl = new URL(moduleWorkerUrl, origin);
	}

	const workerThread = await spawnPHPWorkerThread(
		wasmWorkerBackend,
		wasmWorkerUrl,
		{
			onDownloadProgress: onWasmDownloadProgress,
			options: {
				// Vite doesn't deal well with the dot in the parameters name,
				// passed to the worker via a query string, so we replace
				// it with an underscore
				dataModule: (config.dataModule || '').replace('.', '_'),
				phpVersion: (config.phpVersion || '').replace('.', '_'),
			},
		}
	);

	await registerServiceWorker(
		serviceWorkerUrl + '',
		// Use the service worker path as the version – it will always
		// contain the latest hash of the service worker script.
		serviceWorkerUrl.pathname
	);
	return workerThread;
}

export interface BootConfiguration {
	onWasmDownloadProgress: DownloadProgressCallback;
	phpVersion?: string;
	dataModule?: string;
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
