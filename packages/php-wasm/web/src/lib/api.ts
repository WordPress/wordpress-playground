import { PHPResponse, PHPResponseData } from '@php-wasm/universal';
import * as Comlink from 'comlink';

export type WithAPIState = {
	/**
	 * Resolves to true when the remote API is ready for
	 * Comlink communication, but not necessarily fully initialized yet.
	 */
	isConnected: () => Promise<void>;
	/**
	 * Resolves to true when the remote API is declares it's
	 * fully loaded and ready to be used.
	 */
	isReady: () => Promise<void>;
};
export type RemoteAPI<T> = Comlink.Remote<T> & WithAPIState;

export function consumeAPI<APIType>(
	remote: Worker | Window,
	context: undefined | EventTarget = undefined
): RemoteAPI<APIType> {
	setupTransferHandlers();

	const endpoint =
		remote instanceof Worker
			? remote
			: Comlink.windowEndpoint(remote, context);

	/**
	 * This shouldn't be necessary, but Comlink doesn't seem to
	 * handle the initial isConnected() call correctly unless it's
	 * explicitly provided here. This is especially weird
	 * since the only thing this proxy does is to call the
	 * isConnected() method on the remote API.
	 *
	 * @TODO: Remove this workaround.
	 */
	const api = Comlink.wrap<APIType & WithAPIState>(endpoint);
	const methods = proxyClone(api);
	return new Proxy(methods, {
		get: (target, prop) => {
			if (prop === 'isConnected') {
				return async () => {
					// Keep retrying until the remote API confirms it's connected.
					while (true) {
						try {
							await runWithTimeout(api.isConnected(), 200);
							break;
						} catch (e) {
							// Timeout exceeded, try again. We can't just use a single
							// `runWithTimeout` call because it won't reach the remote API
							// if it's not connected yet. Instead, we need to keep retrying
							// until the remote API is connected and registers a handler
							// for the `isConnected` method.
						}
					}
				};
			}
			return (api as any)[prop];
		},
	}) as unknown as RemoteAPI<APIType>;
}

async function runWithTimeout<T>(
	promise: Promise<T>,
	timeout: number
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		setTimeout(reject, timeout);
		promise.then(resolve);
	});
}

export type PublicAPI<Methods, PipedAPI = unknown> = RemoteAPI<
	Methods & PipedAPI
>;
export function exposeAPI<Methods, PipedAPI>(
	apiMethods?: Methods,
	pipedApi?: PipedAPI
): [() => void, (e: Error) => void, PublicAPI<Methods, PipedAPI>] {
	setupTransferHandlers();

	const connected = Promise.resolve();

	let setReady: any;
	let setFailed: any;
	const ready = new Promise((resolve, reject) => {
		setReady = resolve;
		setFailed = reject;
	});

	const methods = proxyClone(apiMethods);
	const exposedApi = new Proxy(methods, {
		get: (target, prop) => {
			if (prop === 'isConnected') {
				return () => connected;
			} else if (prop === 'isReady') {
				return () => ready;
			} else if (prop in target) {
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
	return [setReady, setFailed, exposedApi];
}

let isTransferHandlersSetup = false;
function setupTransferHandlers() {
	if (isTransferHandlersSetup) {
		return;
	}
	isTransferHandlersSetup = true;
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
		canHandle: (obj: unknown): obj is (...args: any[]) => any =>
			typeof obj === 'function',
		serialize(obj: (...args: any[]) => any) {
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
	// Augment Comlink's throw handler to include Error the response and source
	// information in the serialized error object. BasePHP may throw
	// PHPExecutionFailureError which includes those information and we'll want to
	// display them for the user.
	const throwHandler = Comlink.transferHandlers.get('throw')!;
	const originalSerialize = throwHandler?.serialize;
	throwHandler.serialize = ({ value }: any) => {
		const serialized = originalSerialize({ value }) as any;
		if (value.response) {
			serialized[0].value.response = value.response;
		}
		if (value.source) {
			serialized[0].value.source = value.source;
		}
		return serialized;
	};
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
