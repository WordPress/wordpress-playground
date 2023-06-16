import {
	LatestSupportedPHPVersion,
	MessageListener,
} from '@php-wasm/universal';
import {
	registerServiceWorker,
	spawnPHPWorkerThread,
	exposeAPI,
	consumeAPI,
	recommendedWorkerBackend,
} from '@php-wasm/web';
// @ts-ignore
import { serviceWorkerVersion } from 'virtual:service-worker-version';

import type { PlaygroundWorkerEndpoint } from './worker-thread';
import type { WebClientMixin } from './playground-client';
import ProgressBar, { ProgressBarOptions } from './progress-bar';

// Avoid literal "import.meta.url" on purpose as vite would attempt
// to resolve it during build time. This should specifically be
// resolved by the browser at runtime to reflect the current origin.
const origin = new URL('/', (import.meta || {}).url).origin;

// @ts-ignore
import moduleWorkerUrl from './worker-thread?worker&url';
// Hardcoded for now, this file lives in the /public folder
// @ts-ignore
const iframeHtmlUrl = '/iframe-worker.html';

export const workerBackend = recommendedWorkerBackend;
export const workerUrl: string = (function () {
	switch (workerBackend) {
		case 'webworker':
			return new URL(moduleWorkerUrl, origin) + '';
		case 'iframe': {
			const wasmWorkerUrl = new URL(iframeHtmlUrl, origin);
			wasmWorkerUrl.searchParams.set('scriptUrl', moduleWorkerUrl);
			return wasmWorkerUrl + '';
		}
		default:
			throw new Error(`Unknown backend: ${workerBackend}`);
	}
})();

// @ts-ignore
import serviceWorkerPath from '../../service-worker.ts?worker&url';
import { LatestSupportedWordPressVersion } from './get-wordpress-module';
export const serviceWorkerUrl = new URL(serviceWorkerPath, origin);

const query = new URL(document.location.href).searchParams;
export async function bootPlaygroundRemote() {
	assertNotInfiniteLoadingLoop();

	const hasProgressBar = query.has('progressbar');
	let bar: ProgressBar | undefined;
	if (hasProgressBar) {
		bar = new ProgressBar();
		document.body.prepend(bar.element);
	}

	const wpVersion = parseVersion(
		query.get('wp'),
		LatestSupportedWordPressVersion
	);
	const phpVersion = parseVersion(
		query.get('php'),
		LatestSupportedPHPVersion
	);
	const workerApi = consumeAPI<PlaygroundWorkerEndpoint>(
		await spawnPHPWorkerThread(workerUrl, workerBackend, {
			wpVersion,
			phpVersion,
			persistent: query.has('persistent') ? 'true' : 'false',
		})
	);

	const wpFrame = document.querySelector('#wp') as HTMLIFrameElement;
	const webApi: WebClientMixin = {
		async onDownloadProgress(fn) {
			return workerApi.onDownloadProgress(fn);
		},
		async setProgress(options: ProgressBarOptions) {
			if (!bar) {
				throw new Error('Progress bar not available');
			}
			bar.setOptions(options);
		},
		async setLoaded() {
			if (!bar) {
				throw new Error('Progress bar not available');
			}
			bar.destroy();
		},
		async onNavigation(fn) {
			// Manage the address bar
			wpFrame.addEventListener('load', async (e: any) => {
				try {
					const path = await playground.internalUrlToPath(
						e.currentTarget!.contentWindow.location.href
					);
					fn(path);
				} catch (e) {
					// @TODO: The above call can fail if the remote iframe
					// is embedded in StackBlitz, or presumably, any other
					// environment with restrictive CSP. Any error thrown
					// due to CORS-related stuff crashes the entire remote
					// so let's ignore it for now and find a correct fix in time.
				}
			});
		},
		async goTo(requestedPath: string) {
			/**
			 * People often forget to type the trailing slash at the end of
			 * /wp-admin/ URL and end up with wrong relative hrefs. Let's
			 * fix it for them.
			 */
			if (requestedPath === '/wp-admin') {
				requestedPath = '/wp-admin/';
			}
			wpFrame.src = await playground.pathToInternalUrl(requestedPath);
		},
		async getCurrentURL() {
			return await playground.internalUrlToPath(wpFrame.src);
		},
		async setIframeSandboxFlags(flags: string[]) {
			wpFrame.setAttribute('sandbox', flags.join(' '));
		},
		/**
		 * This function is merely here to explicitly call workerApi.onMessage.
		 * Comlink should be able to handle that on its own, but something goes
		 * wrong and if this function is not here, we see the following error:
		 *
		 * Error: Failed to execute 'postMessage' on 'Worker': function() {
		 * } could not be cloned.
		 *
		 * In the future, this explicit declaration shouldn't be needed.
		 *
		 * @param callback
		 * @returns
		 */
		async onMessage(callback: MessageListener) {
			return await workerApi.onMessage(callback);
		},
	};

	await workerApi.isConnected();

	// If onDownloadProgress is not explicitly re-exposed here,
	// Comlink will throw an error and claim the callback
	// cannot be cloned. Adding a transfer handler for functions
	// doesn't help:
	// https://github.com/GoogleChromeLabs/comlink/issues/426#issuecomment-578401454
	// @TODO: Handle the callback conversion automatically and don't explicitly re-expose
	//        the onDownloadProgress method
	const [setAPIReady, playground] = exposeAPI(webApi, workerApi);

	await workerApi.isReady();
	await registerServiceWorker(
		workerApi,
		await workerApi.scope,
		serviceWorkerUrl + '',
		serviceWorkerVersion
	);
	setupPostMessageRelay(wpFrame, getOrigin(await playground.absoluteUrl));
	wpFrame.src = await playground.pathToInternalUrl('/');

	setAPIReady();

	/*
	 * An asssertion to make sure Playground Client is compatible
	 * with Remote<PlaygroundClient>
	 */
	return playground;
}

function getOrigin(url: string) {
	return new URL(url, 'https://example.com').origin;
}

function setupPostMessageRelay(
	wpFrame: HTMLIFrameElement,
	expectedOrigin: string
) {
	window.addEventListener('message', (event) => {
		if (event.source !== wpFrame.contentWindow) {
			return;
		}

		if (event.origin !== expectedOrigin) {
			return;
		}

		if (typeof event.data !== 'object' || event.data.type !== 'relay') {
			return;
		}

		window.parent.postMessage(event.data, '*');
	});
}

function parseVersion<T>(value: string | undefined | null, latest: T) {
	if (!value || value === 'latest') {
		return (latest as string).replace('.', '_');
	}
	/*
	 * Vite doesn't deal well with the dot in the parameters name,
	 * passed to the worker via a query string, so we replace
	 * it with an underscore
	 */
	return value.replace('.', '_');
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
	} catch (e) {
		// ignore
	}
	if (isBrowserInABrowser) {
		throw new Error(
			'The service worker did not load correctly. This is a bug, please report it on https://github.com/WordPress/wordpress-playground/issues'
		);
	}
	(window as any).IS_WASM_WORDPRESS = true;
}
