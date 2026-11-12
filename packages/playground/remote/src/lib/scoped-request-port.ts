import { responseTo } from '@php-wasm/web-service-worker';

export const REGISTER_SCOPED_REQUEST_PORT = 'register-scoped-request-port';
export const CONNECT_SCOPED_REQUEST_PORT = 'connect-scoped-request-port';

export type ScopedRequestMessage = {
	method: string;
	args?: any[];
	requestId: number;
};
export type ScopedRequestReply = (
	response: unknown,
	transfer?: Transferable[]
) => void;

/**
 * Receive one scope's PHP requests from the service worker over a private port.
 *
 * The service worker sends a scope's requests only to the port registered for
 * it, so other pages on the same origin never see them. Each reply goes back
 * through the port that carried its request. A worker restart or update drops
 * every port; the new worker then asks for a connection and this registers again.
 *
 * @param scope The scope whose requests this document serves.
 * @param serviceWorker The active service worker to register with first.
 * @param onRequest Handles one request and calls reply() once with its result.
 */
export function serveScopedRequests(
	scope: string,
	serviceWorker: ServiceWorker,
	onRequest: (
		request: ScopedRequestMessage,
		reply: ScopedRequestReply
	) => void
) {
	const connect = (worker: ServiceWorker) => {
		const { port1, port2 } = new MessageChannel();
		port1.onmessage = ({ data }: MessageEvent<ScopedRequestMessage>) =>
			onRequest(data, (response, transfer = []) =>
				port1.postMessage(
					responseTo(data.requestId, response),
					transfer
				)
			);
		worker.postMessage({ type: REGISTER_SCOPED_REQUEST_PORT, scope }, [
			port2,
		]);
	};
	navigator.serviceWorker.addEventListener('message', (event) => {
		if (event.data?.type === CONNECT_SCOPED_REQUEST_PORT) {
			connect(event.source as ServiceWorker);
		}
	});
	connect(serviceWorker);
}
