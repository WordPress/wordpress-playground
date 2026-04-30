/**
 * Spawns a new Worker Thread.
 *
 * @param  workerUrl The absolute URL of the worker script.
 * @returns The spawned Worker Thread.
 */
export async function spawnPHPWorkerThread(workerUrl: string) {
	console.warn('[diagnostic spawnPHPWorkerThread create]', {
		workerUrl,
		location: globalThis.location?.href,
		stack: new Error().stack,
	});
	const worker = new Worker(workerUrl, { type: 'module' });
	let startupMessageCount = 0;
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
		// There is no way to know when the worker script has started
		// executing, so we use a message to signal that.
		function onStartup(event: { data: string }) {
			if (event.data === 'worker-script-started') {
				startupMessageCount++;
				console.warn('[diagnostic spawnPHPWorkerThread startup]', {
					workerUrl,
					startupMessageCount,
					location: globalThis.location?.href,
				});
				resolve(worker);
				worker.removeEventListener('message', onStartup);
			}
		}
		worker.addEventListener('message', onStartup);
	});
}
