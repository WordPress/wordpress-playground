import * as Comlink from 'comlink';
import { PHPProtocolClient } from '../../php-library/php-protocol-client';
import { setupTransferHandlers } from '../../php-library/transfer-handlers';

/**
 * Spawns a new Worker Thread.
 *
 * @param  workerUrl The absolute URL of the worker script.
 * @param  workerBackend     The Worker Thread backend to use. Either 'webworker' or 'iframe'.
 * @param  config
 * @returns  The spawned Worker Thread.
 */
export async function spawnPHPWorkerThread(
	workerUrl: string,
	workerBackend: 'webworker' | 'iframe' = 'webworker',
	startupOptions: Record<string, string> = {}
): Promise<PHPProtocolClient> {
	setupTransferHandlers()
	workerUrl = addQueryParams(workerUrl, startupOptions);

	if (workerBackend === 'webworker') {
		return Comlink.wrap(new Worker(workerUrl, { type: 'module' }))
	} else if (workerBackend === 'iframe') {
		const target = createIframe(workerUrl).contentWindow!;
		return Comlink.wrap(Comlink.windowEndpoint(target));
	} else {
		throw new Error(`Unknown backendName: ${workerBackend}`);
	}
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
