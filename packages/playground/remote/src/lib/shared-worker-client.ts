// @ts-ignore -- Vite resolves the worker URL.
import sharedWorkerEntryPointUrl from './playground-worker-endpoint-blueprints.ts?sharedworker&url';

export async function bootPlaygroundSharedWorkerClient() {
	const query = new URL(document.location.href).searchParams;
	// Only browsers that accept extendedLifetime create these bridge frames.
	const worker = (await spawnSharedPlaygroundWorker(
		query.get('php-worker-id')!
	))!;
	const scope = query.get('php-worker-scope');
	const connectServiceWorker = async () => {
		const serviceWorker =
			navigator.serviceWorker.controller ??
			(await navigator.serviceWorker.ready).active!;
		const { port1, port2 } = new MessageChannel();
		worker.port.postMessage(
			{ type: 'playground-service-worker-connect', port: port1 },
			[port1]
		);
		serviceWorker.postMessage(
			{ type: 'php-worker-connect', scope, port: port2 },
			[port2]
		);
	};
	await connectServiceWorker();
	navigator.serviceWorker.addEventListener(
		'controllerchange',
		connectServiceWorker
	);
	navigator.serviceWorker.addEventListener('message', (event) => {
		if (event.data.scope !== scope || !event.data.port) {
			return;
		}
		// Send the reply port to PHP so the response and body do not pass through this frame.
		worker.port.postMessage(
			{ ...event.data, type: 'playground-service-worker-request' },
			[event.data.port]
		);
	});
	navigator.serviceWorker.startMessages();
}

export async function spawnSharedPlaygroundWorker(workerId: string) {
	const url = new URL(sharedWorkerEntryPointUrl, document.location.href);
	// Use the URL to separate sites, including browsers that ignore the name option.
	url.searchParams.set('php-worker-id', workerId);
	if (
		new URL(document.location.href).searchParams.has(
			'with-admin-transitions'
		)
	) {
		url.searchParams.set('with-admin-transitions', '1');
	}
	// Without extendedLifetime, reloading the last tab can destroy PHP between documents.
	// Dictionary conversion only reads options the browser recognizes. Detect that read
	// instead of relying on SharedWorker availability or the browser's name.
	let supportsExtendedLifetime = false;
	const options: WorkerOptions & { extendedLifetime: boolean } = {
		type: 'module',
		get extendedLifetime() {
			supportsExtendedLifetime = true;
			return true;
		},
	};
	const worker = new SharedWorker(url, options);
	if (!supportsExtendedLifetime) {
		worker.port.close();
		return undefined;
	}
	await new Promise<void>((resolve, reject) => {
		worker.onerror = (event) => reject(new Error(event.message));
		worker.port.addEventListener('message', function onStartup(event) {
			if (event.data === 'worker-script-started') {
				worker.port.removeEventListener('message', onStartup);
				resolve();
			}
		});
		worker.port.start();
	});
	return worker;
}
