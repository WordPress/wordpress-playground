/**
 * Spawns a new Worker Thread.
 *
 * @param  workerUrl The absolute URL of the worker script.
 * @returns The spawned Worker Thread.
 */
export async function spawnPHPWorkerThread(
	workerUrl: string,
	sharedWorkerUrl: string,
	scope: string
): Promise<Worker | SharedWorker> {
	/**
	 * Shared workers are identified by the URL of the script used
	 * to create it, optionally with an explicit name. The name allows
	 * multiple instances of a particular shared worker to be started.
	 *
	 * https://html.spec.whatwg.org/dev/workers.html#shared-workers
	 */
	const { worker, messagePort } = createWorker(
		workerUrl,
		sharedWorkerUrl,
		scope
	);
	return new Promise<Worker | SharedWorker>((resolve, reject) => {
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
		function onStartup(event: any) {
			console.log({ event });
			if (event?.data === 'worker-script-started') {
				resolve(worker);
				worker.removeEventListener('message', onStartup);
			}
		}
		messagePort.onmessage = onStartup;
		// messagePort.addEventListener('message', onStartup);
	});
}

function createWorker(
	workerUrl: string,
	sharedWorkerUrl: string,
	scope: string
) {
	if (1 && typeof SharedWorker !== 'undefined') {
		const worker = new SharedWorker(sharedWorkerUrl, {
			type: 'module',
			name: scope,
		});
		worker.port.onmessageerror = () => {
			console.log('Error');
		};
		worker.addEventListener('message', () => {
			console.log('add event listener message');
		});
		worker.port.addEventListener('message', () => {
			console.log('add event listener message');
		});
		// worker.port.start();
		return {
			worker,
			messagePort: worker.port,
		};
	} else {
		// const worker = new Worker(workerUrl, { type: 'module' });
		return {
			worker,
			messagePort: worker,
		};
	}
}
