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
