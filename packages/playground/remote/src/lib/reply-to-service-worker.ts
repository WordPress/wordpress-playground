import { streamToPort } from '@php-wasm/universal';
import { responseTo } from '@php-wasm/web-service-worker';
import type { PlaygroundWorkerEndpoint } from './playground-worker-endpoint';

export async function replyToServiceWorker(
	api: PlaygroundWorkerEndpoint,
	message: { requestId: number; method: string; args?: any[] },
	port: MessagePort
) {
	try {
		const args = message.args || [];
		if (message.method === 'request') {
			const response = await api.requestStreamed(args[0]);
			const httpStatusCode = await response.httpStatusCode;
			const headers = await response.headers;
			// ReadableStreams cannot be transferred to service workers in Chromium.
			// Bridge the body through a port, just like the dedicated-worker relay.
			const bodyPort = streamToPort(response.stdout);
			port.postMessage(
				responseTo(message.requestId, {
					httpStatusCode,
					headers,
					bodyPort,
				}),
				[bodyPort]
			);
		} else if (message.method === 'getWordPressModuleDetails') {
			port.postMessage(
				responseTo(
					message.requestId,
					await api.getWordPressModuleDetails()
				)
			);
		}
	} finally {
		port.close();
	}
}
