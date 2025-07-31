import type { PHPResponseData } from './php-response';
import { PHPResponse } from './php-response';
import * as Comlink from './comlink-sync';
import {
	NodeSABSyncReceiveMessageTransport,
	nodeEndpoint,
	type NodeEndpoint,
	type Remote,
	type Endpoint,
	type IsomorphicMessagePort,
} from './comlink-sync';
import * as ErrorSerializer from './serialize-error';

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
export type RemoteAPI<T> = Remote<T> & WithAPIState;

export async function consumeAPISync<APIType>(
	remote: IsomorphicMessagePort
): Promise<APIType> {
	setupTransferHandlers();
	const transport = await NodeSABSyncReceiveMessageTransport.create();
	return Comlink.wrapSync<APIType>(remote, transport);
}

export function consumeAPI<APIType>(
	remote: Worker | Window | NodeEndpoint,
	context: undefined | EventTarget = undefined
): RemoteAPI<APIType> {
	setupTransferHandlers();

	let endpoint;
	const appearsToBeNodeEnvironment = import.meta.url.startsWith('file://');
	if (appearsToBeNodeEnvironment) {
		endpoint = nodeEndpoint(remote as NodeEndpoint);
	} else {
		endpoint =
			remote instanceof Worker
				? remote
				: Comlink.windowEndpoint(remote as Window, context);
	}

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
						} catch {
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
	pipedApi?: PipedAPI,
	targetWorker?: NodeEndpoint
): [() => void, (e: Error) => void, PublicAPI<Methods, PipedAPI>] {
	const { setReady, setFailed, exposedApi } = prepareForExpose(
		apiMethods,
		pipedApi
	);
	let endpoint: Endpoint | undefined;
	if (targetWorker) {
		// NOTE: If there are other target types, we could expand this later,
		// but for now, we only need support for NodeEndpoints.
		endpoint = nodeEndpoint(targetWorker);
	} else {
		endpoint =
			typeof window !== 'undefined'
				? Comlink.windowEndpoint(self.parent)
				: undefined;
	}
	Comlink.expose(exposedApi, endpoint);
	return [setReady, setFailed, exposedApi as PublicAPI<Methods, PipedAPI>];
}

export async function exposeSyncAPI<Methods>(
	apiMethods: Methods,
	port: IsomorphicMessagePort
): Promise<[() => void, (e: Error) => void, Methods]> {
	const { setReady, setFailed, exposedApi } = prepareForExpose(apiMethods);
	const transport = await NodeSABSyncReceiveMessageTransport.create();
	const endpoint = nodeEndpoint(port as any);
	Comlink.exposeSync(exposedApi, endpoint, transport);
	return [setReady, setFailed, exposedApi as Methods];
}

function prepareForExpose<Methods, PipedAPI>(
	apiMethods?: Methods,
	pipedApi?: PipedAPI
) {
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

	return { setReady, setFailed, exposedApi };
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
		// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
		canHandle: (obj: unknown): obj is Function => typeof obj === 'function',
		// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
		serialize(obj: Function) {
			const { port1, port2 } = new MessageChannel();
			Comlink.expose(obj, port1);
			return [port2, [port2]];
		},
		deserialize(port: any) {
			port.start();
			return Comlink.wrap(port);
		},
	});
	Comlink.transferHandlers.set('MESSAGE_PORT', {
		canHandle: (obj: unknown): obj is MessagePort =>
			obj instanceof MessagePort,
		serialize(port: MessagePort): [MessagePort, Transferable[]] {
			return [port, [port]];
		},
		deserialize(port: MessagePort): MessagePort {
			return port;
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

// Augment Comlink's throw handler to include all the information carried by
// the thrown object, including the cause, additional properties, etc.
interface UnserializedError {
	value: unknown;
}
type SerializedError =
	| { isError: true; value: ErrorSerializer.ErrorObject }
	| { isError: false; value: unknown };

const throwTransferHandler = Comlink.transferHandlers.get(
	'throw'
) as Comlink.TransferHandler<UnserializedError, SerializedError>;

const throwTransferHandlerCustom: Comlink.TransferHandler<
	UnserializedError,
	SerializedError
> = {
	canHandle: throwTransferHandler.canHandle,
	serialize: ({ value }) => {
		let serialized: SerializedError;
		if (value instanceof Error) {
			serialized = {
				isError: true,
				value: ErrorSerializer.serializeError(value),
			};
			// The error class name is not serialized by serialize-error, let's add it manually.
			serialized.value['originalErrorClassName'] = value.constructor.name;
		} else {
			serialized = { isError: false, value };
		}
		return [serialized, []];
	},
	deserialize: (serialized) => {
		if (serialized.isError) {
			const error = ErrorSerializer.deserializeError(serialized.value);
			/**
			 * The original error from the web worker does not include any call
			 * stack from the Playground web app. Let's include that information
			 * in the error chain.
			 *
			 * We'll place it at the bottom of the error chain. This way the API
			 * consumer gets the original error object and not an opaque
			 * "Comlink method call failed" error, but they can still inspect
			 * it further to see the full call stack.
			 */
			const additionalCallStack = new Error('Comlink method call failed');
			let deepestError = error;
			while (deepestError.cause) {
				deepestError = deepestError.cause;
			}
			deepestError.cause = additionalCallStack;
			throw error;
		}
		throw serialized.value;
	},
};

Comlink.transferHandlers.set('throw', throwTransferHandlerCustom);

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
