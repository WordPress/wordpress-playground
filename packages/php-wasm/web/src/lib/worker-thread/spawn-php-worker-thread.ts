/**
 * Spawns a new Worker Thread.
 *
 * @param  workerUrl The absolute URL of the worker script.
 * @param  config
 * @returns The spawned Worker Thread.
 */
export async function spawnPHPWorkerThread(
	workerUrl: string,
	startupOptions: Record<string, string | string[]> = {}
) {
	workerUrl = addQueryParams(workerUrl, startupOptions);
	const worker = new Worker(workerUrl, { type: 'module' });
	return new Promise<Worker>((resolve, reject) => {
		worker.onerror = (e) => {
			const error = new Error(
				`WebWorker failed to load at ${workerUrl}. ${
					e.message ? `Original error: ${e.message}` : ''
				}`
			);
			(error as any).filename = e.filename;
			reject(error);
		};
		worker.postMessage({
			type: 'startup-options',
			startupOptions,
		});
		// There is no way to know when the worker script has started
		// executing, so we use a message to signal that.
		function onStartup(event: { data: string }) {
			if (event.data === 'worker-script-started') {
				resolve(worker);
				worker.removeEventListener('message', onStartup);
			}
		}
		worker.addEventListener('message', onStartup);
	});
}

function addQueryParams(
	url: string | URL,
	searchParams: Record<string, string | string[]>
): string {
	if (!Object.entries(searchParams).length) {
		return url + '';
	}
	const urlWithOptions = new URL(url);
	for (const [key, value] of Object.entries(searchParams)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				urlWithOptions.searchParams.append(key, item);
			}
		} else {
			urlWithOptions.searchParams.set(key, value);
		}
	}
	return urlWithOptions.toString();
}
