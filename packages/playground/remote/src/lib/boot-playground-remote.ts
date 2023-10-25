import {
	LatestSupportedPHPVersion,
	MessageListener,
	SupportedPHPExtensionsList,
	UniversalPHP,
} from '@php-wasm/universal';
import {
	registerServiceWorker,
	spawnPHPWorkerThread,
	exposeAPI,
	consumeAPI,
} from '@php-wasm/web';

import type { PlaygroundWorkerEndpoint } from './worker-thread';
import type { WebClientMixin } from './playground-client';
import ProgressBar, { ProgressBarOptions } from './progress-bar';

// Avoid literal "import.meta.url" on purpose as vite would attempt
// to resolve it during build time. This should specifically be
// resolved by the browser at runtime to reflect the current origin.
const origin = new URL('/', (import.meta || {}).url).origin;

// @ts-ignore
import moduleWorkerUrl from './worker-thread?worker&url';

export const workerUrl: string = new URL(moduleWorkerUrl, origin) + '';

// @ts-ignore
import serviceWorkerPath from '../../service-worker.ts?worker&url';
import { LatestSupportedWordPressVersion } from '../wordpress/get-wordpress-module';
import type { SyncProgressCallback } from './opfs/bind-opfs';
import { FilesystemOperation } from '@php-wasm/fs-journal';
export const serviceWorkerUrl = new URL(serviceWorkerPath, origin);

// Prevent Vite from hot-reloading this file – it would
// cause bootPlaygroundRemote() to register another web worker
// without unregistering the previous one. The first web worker
// would then fight for service worker requests with the second
// one. It's a difficult problem to debug and HMR isn't that useful
// here anyway – let's just disable it for this file.
// @ts-ignore
if (import.meta.hot) {
	// @ts-ignore
	import.meta.hot.accept(() => {});
}

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
	const phpExtensions = parseList(
		query.getAll('php-extension'),
		SupportedPHPExtensionsList
	);
	const workerApi = consumeAPI<PlaygroundWorkerEndpoint>(
		await spawnPHPWorkerThread(workerUrl, {
			wpVersion,
			phpVersion,
			['php-extension']: phpExtensions,
			storage: query.get('storage') || '',
		})
	);

	const wpFrame = document.querySelector('#wp') as HTMLIFrameElement;
	const webApi: WebClientMixin = {
		async onDownloadProgress(fn) {
			return workerApi.onDownloadProgress(fn);
		},
		async journalFSEvents(root: string, callback) {
			return workerApi.journalFSEvents(root, callback);
		},
		async replayFSJournal(events: FilesystemOperation[]) {
			return workerApi.replayFSJournal(events);
		},
		async addEventListener(event, listener) {
			return await workerApi.addEventListener(event, listener);
		},
		async removeEventListener(event, listener) {
			return await workerApi.removeEventListener(event, listener);
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
		/**
		 * Ditto for this function.
		 * @see onMessage
		 * @param callback
		 * @returns
		 */
		async bindOpfs(
			opfs: FileSystemDirectoryHandle,
			onProgress?: SyncProgressCallback
		) {
			return await workerApi.bindOpfs(opfs, onProgress);
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
	const [setAPIReady, setAPIError, playground] = exposeAPI(webApi, workerApi);

	try {
		await workerApi.isReady();
		await registerServiceWorker(
			workerApi,
			await workerApi.scope,
			serviceWorkerUrl + ''
		);
		setupPostMessageRelay(wpFrame, getOrigin(await playground.absoluteUrl));
		setupFetchNetworkTransport(workerApi);

		setAPIReady();
	} catch (e) {
		setAPIError(e as Error);
		throw e;
	}

	/*
	 * An assertion to make sure Playground Client is compatible
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

/**
 * Allow WordPress to make network requests via the fetch API.
 * On the WordPress side, this is handled by Requests_Transport_Fetch
 *
 * @param playground the Playground instance to set up with network support.
 */
async function setupFetchNetworkTransport(playground: UniversalPHP) {
	await playground.onMessage(async (message: string) => {
		const envelope: RequestMessage = JSON.parse(message);
		const { type, data } = envelope;
		if (type !== 'request') {
			return '';
		}

		const hostname = new URL(data.url).hostname;
		const fetchUrl = ['api.wordpress.org', 'w.org', 's.w.org'].includes(
			hostname
		)
			? `/plugin-proxy.php?url=${encodeURIComponent(data.url)}`
			: data.url;

		const response = await fetch(fetchUrl, {
			method: data.method,
			headers: Object.fromEntries(
				data.headers.map((line) => line.split(': '))
			),
			body: data.data,
		});
		const responseHeaders: string[] = [];
		response.headers.forEach((value, key) => {
			responseHeaders.push(key + ': ' + value);
		});

		const headersText =
			[
				'HTTP/1.1 ' + response.status + ' ' + response.statusText,
				...responseHeaders,
			] + `\r\n\r\n`;
		const headersBuffer = new TextEncoder().encode(headersText);
		const bodyBuffer = new Uint8Array(await response.arrayBuffer());
		const jointBuffer = new Uint8Array(
			headersBuffer.byteLength + bodyBuffer.byteLength
		);
		jointBuffer.set(headersBuffer);
		jointBuffer.set(bodyBuffer, headersBuffer.byteLength);

		return jointBuffer;
	});
}

interface RequestMessage {
	type: 'request';
	data: {
		url: string;
		method: string;
		headers: string[];
		data: string;
	};
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

function parseList<T>(value: string[], list: readonly T[]) {
	if (!value) {
		return [];
	}
	return value.filter((item) => list.includes(item as any));
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
