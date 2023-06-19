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
