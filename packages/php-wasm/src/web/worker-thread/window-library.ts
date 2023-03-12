import * as Comlink from 'comlink';
import { responseTo } from '../../php-library/messaging';
import type { DownloadProgressEvent } from '../emscripten-download-monitor';
import { PHPProtocolClient } from '../../php-library/php-protocol-client';
// import { setupTransferHandlers } from '../../php-library/transfer-handlers';
// setupTransferHandlers()
const noop = () => null;

interface WorkerThreadConfig {
	/**
	 * A function to call when a download progress event is received from the worker
	 */
	onDownloadProgress?: (event: DownloadProgressEvent) => void;

	/**
	 * A record of options to pass to the worker thread.
	 */
	options?: Record<string, string>;
}

/**
 * Spawns a new Worker Thread.
 *
 * @param  backendName     The Worker Thread backend to use. Either 'webworker' or 'iframe'.
 * @param  workerScriptUrl The absolute URL of the worker script.
 * @param  config
 * @returns  The spawned Worker Thread.
 */
export async function spawnPHPWorkerThread(
	backendName: 'webworker' | 'iframe',
	workerScriptUrl: string,
	config: WorkerThreadConfig
): Promise<PHPProtocolClient> {
	const { onDownloadProgress = noop } = config;

	workerScriptUrl = addQueryParams(workerScriptUrl, config.options || {});

	let remote;
	if (backendName === 'webworker') {
		remote = Comlink.wrap(new Worker(workerScriptUrl, { type: 'module' }))
	} else if (backendName === 'iframe') {
		const target = createIframe(workerScriptUrl).contentWindow!;
		remote = Comlink.wrap(Comlink.windowEndpoint(target));
	} else {
		throw new Error(`Unknown backendName: ${backendName}`);
	}

	console.log({remote, workerScriptUrl})

	await remote.addProgressListener(Comlink.proxy(onDownloadProgress));
	await remote.onReady();

	// Proxy the service worker messages to the worker thread:
	const scope = await remote.scope;
	navigator.serviceWorker.addEventListener(
		'message',
		async function onMessage(event) {
			console.debug('Message from ServiceWorker', event);
			/**
			 * Ignore events meant for other PHP instances to
			 * avoid handling the same event twice.
			 *
			 * This is important because the service worker posts the
			 * same message to all application instances across all browser tabs.
			 */
			if (scope && event.data.scope !== scope) {
				return;
			}

			let result;
			if (event.data.method === 'request') {
				result = await remote.browser.request(...event.data.args);
			} else if (event.data.method === "getWordPressModuleDetails") {
				result = await remote.getWordPressModuleDetails();
			}
			event.source!.postMessage(
				responseTo(event.data.requestId, result)
			);
		}
	);
	
	return remote;
}

function addQueryParams(url, searchParams: Record<string, string>) {
	if (!Object.entries(searchParams).length) {
		return url;
	}
	const urlWithOptions = new URL(url);
	for (const [key, value] of Object.entries(searchParams)) {
		urlWithOptions.searchParams.set(key, value);
	}
	return urlWithOptions.toString();
}

function createIframe( workerDocumentURL: string ) {
	const iframe = document.createElement('iframe');
	iframe.src = workerDocumentURL;
	iframe.style.display = 'none';
	document.body.appendChild(iframe);
	return iframe;
}
