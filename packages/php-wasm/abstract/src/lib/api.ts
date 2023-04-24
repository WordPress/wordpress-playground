import * as Comlink from 'comlink';
import { PHPResponse, PHPResponseData } from './php-response';

export type WorkerStartupOptions<
	T extends Record<string, string> = Record<string, string>
> = T;

export function consumeAPI<APIType>(remote: Worker | Window) {
	setupTransferHandlers();

	const endpoint =
		remote instanceof Worker ? remote : Comlink.windowEndpoint(remote);

	return Comlink.wrap<APIType>(endpoint);
}

export type PublicAPI<Methods, PipedAPI = unknown> = Methods &
	PipedAPI & { isReady: () => Promise<void> };
export function exposeAPI<Methods, PipedAPI>(
	apiMethods?: Methods,
	pipedApi?: PipedAPI
): [() => void, PublicAPI<Methods, PipedAPI>] {
	setupTransferHandlers();

	let setReady: any;
	const ready = new Promise((resolve) => {
		setReady = resolve;
	});

	const methods = proxyClone(apiMethods);
	const exposedApi = new Proxy(methods, {
		get: (target, prop) => {
			if (prop === 'isReady') {
				return () => ready;
			}
			if (prop in target) {
				return target[prop];
			}
			return (pipedApi as any)?.[prop];
		},
	}) as unknown as PublicAPI<Methods, PipedAPI>;

	Comlink.expose(
		exposedApi,
		typeof window !== 'undefined'
			? Comlink.windowEndpoint(self.parent)
			: undefined
	);
	return [setReady, exposedApi];
}

function setupTransferHandlers() {
	Comlink.transferHandlers.set('EVENT', {
		canHandle: (obj): obj is CustomEvent => obj instanceof CustomEvent,
		serialize: (ev: CustomEvent) => {
			return [
				{
					detail: ev.detail,
				},
				[],
			];
		},
		deserialize: (obj) => obj,
	});
	Comlink.transferHandlers.set('FUNCTION', {
		canHandle: (obj: unknown): obj is Function => typeof obj === 'function',
		serialize(obj: Function) {
			console.debug('[Comlink][Performance] Proxying a function');
			const { port1, port2 } = new MessageChannel();
			Comlink.expose(obj, port1);
			return [port2, [port2]];
		},
		deserialize(port: any) {
			port.start();
			return Comlink.wrap(port);
		},
	});
	Comlink.transferHandlers.set('PHPResponse', {
		canHandle: (obj: unknown): obj is PHPResponseData =>
			typeof obj === 'object' &&
			obj !== null &&
			'headers' in obj &&
			'bytes' in obj &&
			'errors' in obj &&
			'exitCode' in obj &&
			'httpStatusCode' in obj,
		serialize(obj: PHPResponse): [PHPResponseData, Transferable[]] {
			return [obj.toRawData(), []];
		},
		deserialize(responseData: PHPResponseData): PHPResponse {
			return PHPResponse.fromRawData(responseData);
		},
	});
}

function proxyClone(object: any): any {
	return new Proxy(object, {
		get(target, prop) {
			switch (typeof target[prop]) {
				case 'function':
					return (...args: any[]) => target[prop](...args);
				case 'object':
					if (target[prop] === null) {
						return target[prop];
					}
					return proxyClone(target[prop]);
				case 'undefined':
				case 'number':
				case 'string':
					return target[prop];
				default:
					return Comlink.proxy(target[prop]);
			}
		},
	});
}
