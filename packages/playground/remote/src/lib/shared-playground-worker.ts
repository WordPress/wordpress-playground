/// <reference lib="WebWorker" />
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { exposeAPI } from '@php-wasm/web';
import { responseTo } from '@php-wasm/web-service-worker';
import { buildVersion } from 'virtual:remote-config';
import { PlaygroundWorkerEndpointBlueprints } from './blueprints-worker';
import { SharedRuntime } from './shared-runtime';

declare const self: SharedWorkerGlobalScope;

const endpoint = new PlaygroundWorkerEndpointBlueprints(
	new EmscriptenDownloadMonitor(),
	() => {},
	() => {}
);
const runtime = new SharedRuntime(endpoint, buildVersion, () => {
	setTimeout(() => self.close(), 0);
});

self.addEventListener('connect', (event) => {
	const port = event.ports[0];
	const [ready, failed] = exposeAPI(runtime.api(port), undefined, port);
	runtime.connect(port, ready, failed);
	port.addEventListener('message', (message) => {
		if (message.data?.type !== 'shared-runtime-service-worker') return;
		const servicePort = message.ports[0];
		runtime.registerServicePort(servicePort);
		servicePort.onmessage = async ({ data }) => {
			try {
				await runtime.handleServiceWorkerRequest(data, servicePort);
			} catch (error) {
				servicePort.postMessage(
					responseTo(data.requestId, {
						error:
							error instanceof Error
								? error.message
								: String(error),
					})
				);
			}
		};
	});
});
