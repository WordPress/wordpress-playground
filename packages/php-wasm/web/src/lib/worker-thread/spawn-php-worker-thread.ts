/**
 * Spawns a new Worker Thread.
 *
 * @param  workerUrl The absolute URL of the worker script.
 * @param  config
 * @returns The spawned Worker Thread.
 */
export async function spawnPHPWorkerThread(
	workerUrl: string,
	startupOptions: Record<string, string> = {}
) {
	workerUrl = addQueryParams(workerUrl, startupOptions);
	return new Worker(workerUrl, { type: 'module' });
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
