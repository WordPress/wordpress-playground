/**
 * Recommended Worker Thread backend.
 * It's typically "webworker", but in Firefox it's "iframe"
 * because Firefox doesn't support module workers with dynamic imports.
 * See https://github.com/mdn/content/issues/24402
 */
export const recommendedWorkerBackend = (function () {
	const isFirefox =
		typeof navigator !== 'undefined' &&
		navigator?.userAgent?.toLowerCase().indexOf('firefox') > -1;
	if (isFirefox) {
		return 'iframe';
	} else {
		return 'webworker';
	}
})();

/**
 * Spawns a new Worker Thread.
 *
 * @param  workerUrl The absolute URL of the worker script.
 * @param  workerBackend     The Worker Thread backend to use. Either 'webworker' or 'iframe'.
 * @param  config
 * @returns The spawned Worker Thread.
 */
export async function spawnPHPWorkerThread(
	workerUrl: string,
	workerBackend: 'webworker' | 'iframe' = 'webworker',
	startupOptions: Record<string, string> = {}
) {
	workerUrl = addQueryParams(workerUrl, startupOptions);

	if (workerBackend === 'webworker') {
		return new Worker(workerUrl, { type: 'module' });
	} else if (workerBackend === 'iframe') {
		return (await createIframe(workerUrl)).contentWindow!;
	} else {
		throw new Error(`Unknown backendName: ${workerBackend}`);
	}
}

function addQueryParams(
	url: string | URL,
	searchParams: Record<string, string>
): string {
	if (!Object.entries(searchParams).length) {
		return url + '';
	}
	const urlWithOptions = new URL(url);
	for (const [key, value] of Object.entries(searchParams)) {
		urlWithOptions.searchParams.set(key, value);
	}
	return urlWithOptions.toString();
}

async function createIframe(workerDocumentURL: string) {
	const iframe = document.createElement('iframe');
	const relativeUrl = '/' + workerDocumentURL.split('/').slice(-1)[0];
	iframe.src = relativeUrl;
	iframe.style.display = 'none';
	document.body.appendChild(iframe);
	await new Promise((resolve) => {
		iframe.addEventListener('load', resolve);
	});
	return iframe;
}
