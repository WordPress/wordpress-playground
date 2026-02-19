import type { PHPResponseData } from './php-response';
import { PHPResponse, StreamedPHPResponse } from './php-response';
import * as Comlink from './comlink-sync';
import {
	NodeSABSyncReceiveMessageTransport,
	nodeEndpoint as nodeWorkerEndpoint,
	releaseProxy,
	type NodeEndpoint as NodeWorker,
	type Remote,
	type Endpoint,
	type IsomorphicMessagePort,
	type ProxyMethods,
} from './comlink-sync';
import {
	type NodeProcess,
	nodeProcessEndpoint,
} from './comlink-node-process-adapter';
import * as ErrorSerializer from './serialize-error';

// NOTE: It seems like we wouldn't have to explicitly specify
// symbol type here, but it seems to resolve some type errors.
export const releaseApiProxy: typeof releaseProxy = releaseProxy;

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
export type RemoteAPI<T> = Remote<T> & ProxyMethods & WithAPIState;

export async function consumeAPISync<APIType>(
	remote: IsomorphicMessagePort
): Promise<APIType> {
	setupTransferHandlers();
	const transport = await NodeSABSyncReceiveMessageTransport.create();
	return Comlink.wrapSync<APIType>(remote, transport);
}

export function consumeAPI<APIType>(
	remote: Worker | Window | NodeWorker | NodeProcess,
	context: undefined | EventTarget = undefined
): RemoteAPI<APIType> {
	setupTransferHandlers();

	let endpoint;
	/**
	 * Previously we assumed we were running in a Node.js environment
	 * when `import.meta.url` started with `file://`. But this assumption breaks
	 * with webpack which emits file URLs for `import.meta.url`.
	 * https://webpack.js.org/api/module-variables/#importmetaurl
	 * 
	 * We replaced this with a more explicit check for `process.versions.node`.
	 * See https://github.com/WordPress/wordpress-playground/pull/3248
	 */
	const appearsToBeNodeEnvironment =
		typeof process !== 'undefined' &&
		typeof process.versions !== 'undefined' &&
		typeof process.versions.node !== 'undefined';
	if (appearsToBeNodeEnvironment) {
		if ('postMessage' in remote) {
			endpoint = nodeWorkerEndpoint(remote as NodeWorker);
		} else if ('send' in remote && 'addListener' in remote) {
			endpoint = nodeProcessEndpoint(remote as NodeProcess);
		} else {
			throw new Error(
				'consumeAPI: remote does not look like a Worker, MessagePort, or Process'
			);
		}
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
	targetWorker?: MessagePort | NodeWorker | NodeProcess
): [() => void, (e: Error) => void, PublicAPI<Methods, PipedAPI>] {
	const { setReady, setFailed, exposedApi } = prepareForExpose(
		apiMethods,
		pipedApi
	);
	let endpoint: Endpoint | undefined;
	if (targetWorker) {
		if ('addEventListener' in targetWorker) {
			// TODO: MessagePort satisfies Endpoint at runtime but its
			// addEventListener overloads don't exactly match EventSource.
			endpoint = targetWorker as Endpoint;
		} else if ('postMessage' in targetWorker) {
			endpoint = nodeWorkerEndpoint(targetWorker);
		} else if ('send' in targetWorker && 'addListener' in targetWorker) {
			endpoint = nodeProcessEndpoint(targetWorker);
		} else {
			throw new Error(
				'exposeAPI: targetWorker does not look like a Worker, MessagePort, or Process'
			);
		}
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
	const endpoint = nodeWorkerEndpoint(port as any);
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
			const data = obj.toRawData();
			// Transfer the ArrayBuffer instead of cloning it to avoid
			// "could not be cloned" errors when the buffer is detached
			const transferables: Transferable[] = [];
			if (data.bytes.buffer.byteLength > 0) {
				transferables.push(data.bytes.buffer);
			}
			return [data, transferables];
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

	Comlink.transferHandlers.set('StreamedPHPResponse', {
		canHandle: (obj: unknown): obj is StreamedPHPResponse =>
			obj instanceof StreamedPHPResponse,
		serialize(obj: StreamedPHPResponse): [any, Transferable[]] {
			const supportsStreams = supportsTransferableStreams();
			const exitCodePort = promiseToPort(obj.exitCode);
			const headersStream = obj.getHeadersStream();
			if (supportsStreams) {
				const payload = {
					__type: 'StreamedPHPResponse',
					headers: headersStream,
					stdout: obj.stdout,
					stderr: obj.stderr,
					exitCodePort,
				};
				// ReadableStreams must be explicitly transferred
				return [
					payload,
					[
						headersStream as unknown as Transferable,
						obj.stdout as unknown as Transferable,
						obj.stderr as unknown as Transferable,
						exitCodePort,
					],
				];
			}
			// Fallback: bridge streams via MessagePorts
			const headersPort = streamToPort(headersStream);
			const stdoutPort = streamToPort(obj.stdout);
			const stderrPort = streamToPort(obj.stderr);
			const payload = {
				__type: 'StreamedPHPResponse',
				headersPort,
				stdoutPort,
				stderrPort,
				exitCodePort,
			};
			return [
				payload,
				[headersPort, stdoutPort, stderrPort, exitCodePort],
			];
		},
		deserialize(data: any): StreamedPHPResponse {
			if (data.headers && data.stdout && data.stderr) {
				const exitCode = portToPromise(
					data.exitCodePort as MessagePort
				);
				return new StreamedPHPResponse(
					data.headers as ReadableStream<Uint8Array>,
					data.stdout as ReadableStream<Uint8Array>,
					data.stderr as ReadableStream<Uint8Array>,
					exitCode
				);
			}
			const headers = portToStream(data.headersPort as MessagePort);
			const stdout = portToStream(data.stdoutPort as MessagePort);
			const stderr = portToStream(data.stderrPort as MessagePort);
			const exitCode = portToPromise(data.exitCodePort as MessagePort);
			return new StreamedPHPResponse(headers, stdout, stderr, exitCode);
		},
	});
}

// Utilities for transferring ReadableStreams and Promises via MessagePorts:

/**
 * Safari does not support transferable streams, so we need to fallback to
 * MessagePorts.
 * Feature-detects whether this runtime supports transferring ReadableStreams
 * directly through postMessage (aka "transferable streams"). When false,
 * we must fall back to port-bridged streaming.
 */
function supportsTransferableStreams(): boolean {
	try {
		if (typeof ReadableStream === 'undefined') return false;
		const { port1 } = new MessageChannel();
		const rs = new ReadableStream();
		port1.postMessage(rs as any);
		try {
			port1.close();
		} catch (_e) {
			void _e;
		}
		return true;
	} catch (_e) {
		void _e;
		return false;
	}
}

/**
 * Bridges a ReadableStream to a MessagePort by reading chunks and posting
 * messages to the port. Used as a fallback when transferable streams are not
 * supported (e.g., Safari).
 *
 * Protocol of the returned MessagePort:
 *
 *   { t: 'chunk', b: ArrayBuffer } – next binary chunk
 *   { t: 'close' }                 – end of stream
 *   { t: 'error', m: string }      – terminal error
 */
function streamToPort(stream: ReadableStream<Uint8Array>): MessagePort {
	const { port1, port2 } = new MessageChannel();
	(async () => {
		const reader = stream.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					try {
						port1.postMessage({ t: 'close' });
					} catch {
						// Ignore error
					}
					try {
						port1.close();
					} catch {
						// Ignore error
					}
					break;
				}
				if (value) {
					// Ensure we transfer an owned buffer
					const owned =
						value.byteOffset === 0 &&
						value.byteLength === value.buffer.byteLength
							? value
							: value.slice();
					const buf = owned.buffer;
					try {
						port1.postMessage({ t: 'chunk', b: buf }, [
							buf as unknown as Transferable,
						]);
					} catch {
						port1.postMessage({
							t: 'chunk',
							b: owned.buffer.slice(0),
						});
					}
				}
			}
		} catch (e: any) {
			try {
				port1.postMessage({ t: 'error', m: e?.message || String(e) });
			} catch {
				// Ignore error
			}
		} finally {
			try {
				port1.close();
			} catch {
				// Ignore error
			}
		}
	})();
	return port2;
}

/**
 * Reconstructs a ReadableStream from a MessagePort using the inverse of the
 * streamToPort protocol. Each message enqueues data, closes, or errors.
 */
function portToStream(port: MessagePort): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			const onMessage = (ev: MessageEvent) => {
				const data: any = (ev as any).data;
				if (!data) return;
				switch (data.t) {
					case 'chunk':
						controller.enqueue(new Uint8Array(data.b));
						break;
					case 'close':
						controller.close();
						cleanup();
						break;
					case 'error':
						controller.error(new Error(data.m || 'Stream error'));
						cleanup();
						break;
				}
			};
			const cleanup = () => {
				try {
					port.removeEventListener?.('message', onMessage as any);
				} catch {
					// Ignore error
				}
				try {
					port.onmessage = null;
				} catch {
					// Ignore error
				}
				try {
					port.close();
				} catch {
					// Ignore error
				}
			};
			if (port.addEventListener) {
				port.addEventListener('message', onMessage as any);
			} else if ((port as any).on) {
				(port as any).on('message', (data: any) =>
					onMessage({ data } as any)
				);
			} else {
				port.onmessage = onMessage as any;
			}
			if (typeof port.start === 'function') {
				port.start();
			}
		},
		cancel() {
			try {
				port.close();
			} catch {
				// Ignore error
			}
		},
	});
}

/**
 * Bridges a Promise to a MessagePort so it can be delivered across threads.
 *
 * Protocol of the returned MessagePort:
 *
 *   { t: 'resolve', v: any } – promise resolved with value v
 *   { t: 'reject',  m: str } – promise rejected with message m
 */
function promiseToPort(promise: Promise<any>): MessagePort {
	const { port1, port2 } = new MessageChannel();
	promise
		.then((value) => {
			try {
				port1.postMessage({ t: 'resolve', v: value });
			} catch {
				// Ignore error
			}
		})
		.catch((err) => {
			try {
				port1.postMessage({
					t: 'reject',
					m: (err as any)?.message || String(err),
				});
			} catch {
				// Ignore error
			}
		})
		.finally(() => {
			try {
				port1.close();
			} catch {
				// Ignore error
			}
		});
	return port2;
}

/**
 * Reconstructs a Promise from a MessagePort using the inverse of
 * promiseToPort. Resolves or rejects when the corresponding message arrives.
 */
function portToPromise(port: MessagePort): Promise<any> {
	return new Promise((resolve, reject) => {
		const onMessage = (ev: MessageEvent) => {
			const data: any = (ev as any).data;
			if (!data) return;
			if (data.t === 'resolve') {
				cleanup();
				resolve(data.v);
			} else if (data.t === 'reject') {
				cleanup();
				reject(new Error(data.m || ''));
			}
		};
		const cleanup = () => {
			try {
				port.removeEventListener?.('message', onMessage as any);
			} catch {
				// Ignore error
			}
			try {
				port.onmessage = null;
			} catch {
				// Ignore error
			}
			try {
				port.close();
			} catch {
				// Ignore error
			}
		};
		if (port.addEventListener) {
			port.addEventListener('message', onMessage as any);
		} else if ((port as any).on) {
			(port as any).on('message', (data: any) =>
				onMessage({ data } as any)
			);
		} else {
			port.onmessage = onMessage as any;
		}
		if (typeof port.start === 'function') {
			port.start();
		}
	});
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
