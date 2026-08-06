/**
 * Spawns a new Worker Thread.
 *
 * @param  workerUrl The absolute URL of the worker script.
 * @returns The spawned Worker Thread.
 */
export async function spawnPHPWorkerThread(
	workerUrl: string,
	options: { signal?: AbortSignal } = {}
) {
	options.signal?.throwIfAborted();
	const worker = new Worker(workerUrl, { type: 'module' });
	return new Promise<Worker>((resolve, reject) => {
		const onAbort = () => {
			worker.terminate();
			worker.removeEventListener('message', onStartup);
			reject(options.signal?.reason);
		};
		options.signal?.addEventListener('abort', onAbort, { once: true });
		worker.onerror = (e) => {
			options.signal?.removeEventListener('abort', onAbort);
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
				resolve(worker);
				worker.removeEventListener('message', onStartup);
				worker.onerror = null;
			}
		}
		worker.addEventListener('message', onStartup);
	});
}
