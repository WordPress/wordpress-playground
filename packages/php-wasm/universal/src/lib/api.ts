import {
	phpEventStdinTransfer,
	type PHPEventWithStdinTransfer,
} from '@php-wasm/util';
import type { PHPResponseData } from './php-response';
import { PHPResponse, StreamedPHPResponse } from './php-response';
import * as Comlink from './comlink-sync';
import {
	NodeSABSyncReceiveMessageTransport,
	createEndpoint,
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
import type { TransferListItem as NodeTransferable } from 'worker_threads';

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
	 * Resolves when the remote API declares that it is fully initialized and
	 * ready to be used.
	 */
	isReady: () => Promise<void>;
};
export type RemoteAPI<T> = Remote<T> & ProxyMethods & WithAPIState;

/**
 * A value that a transfer policy may add to Comlink's postMessage() transfer
 * list. Only nested MessagePorts make a policy hook statically required;
 * transferring other values, such as ArrayBuffers, is an opt-in ownership
 * decision because it may detach or otherwise invalidate the sender's value.
 */
export type APITransferable = Transferable | NodeTransferable;

/** Any callable API member whose arguments and result can be inspected. */
type AnyMethod = (...args: any[]) => any;

/**
 * Detect `any` before it reaches the recursive type below. TypeScript lets
 * `any` take every conditional branch, which would otherwise produce an
 * unusable or infinitely expanding policy type.
 */
type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Collapse a union of recursive results to one answer: true when at least one
 * member contains a MessagePort.
 */
type AnyContainsMessagePort<Candidates> = true extends Candidates
	? true
	: false;

/**
 * Detect nested ports in the structured-clone containers TypeScript can
 * describe directly. `Seen` stops recursive types from expanding forever
 * without imposing an arbitrary nesting-depth limit.
 */
type ContainsMessagePort<T, Seen = never> =
	IsAny<T> extends true
		? false
		: T extends IsomorphicMessagePort
			? true
			: T extends AnyMethod
				? false
				: T extends Seen
					? false
					: T extends readonly (infer Item)[]
						? ContainsMessagePort<Item, Seen | T>
						: T extends ReadonlyMap<infer Key, infer Value>
							? MapContainsMessagePort<Key, Value, Seen | T>
							: T extends ReadonlySet<infer Item>
								? ContainsMessagePort<Item, Seen | T>
								: T extends object
									? ObjectContainsMessagePort<T, Seen | T>
									: false;

/** Check both the keys and values because either side of a Map is cloned. */
type MapContainsMessagePort<Key, Value, Seen> = AnyContainsMessagePort<
	ContainsMessagePort<Key, Seen> | ContainsMessagePort<Value, Seen>
>;

/** Check every statically known property of a structured-cloneable object. */
type ObjectContainsMessagePort<T extends object, Seen> = AnyContainsMessagePort<
	{
		[Key in keyof T]-?: ContainsMessagePort<T[Key], Seen>;
	}[keyof T]
>;

/**
 * Top-level MessagePorts are already handled by Comlink. A policy is required
 * only when a port is nested inside an argument that Comlink otherwise treats
 * as an ordinary structured-cloned value.
 */
type ArgumentNeedsTransferPolicy<Argument> =
	Argument extends IsomorphicMessagePort
		? false
		: ContainsMessagePort<Argument>;

/**
 * `Parameters` and `ReturnType` inspect only the last signature of an
 * overloaded method. API contracts that need required-policy checking must
 * expose nested MessagePorts in that signature or use a non-overloaded method.
 */
type ArgumentsNeedTransferPolicy<Method extends AnyMethod> =
	true extends ArgumentNeedsTransferPolicy<Parameters<Method>[number]>
		? true
		: false;

/**
 * Like arguments, top-level MessagePort results use Comlink's existing
 * transfer handler. Only a port nested inside the resolved result needs a
 * policy hook.
 */
type ResultNeedsTransferPolicy<Method extends AnyMethod> =
	Awaited<ReturnType<Method>> extends IsomorphicMessagePort
		? false
		: ContainsMessagePort<Awaited<ReturnType<Method>>>;

/**
 * Describe the hooks for one method. A hook becomes required only when the
 * method's visible TypeScript signature proves that nested ports are present.
 */
type MethodTransferPolicy<Method extends AnyMethod> =
	(ArgumentsNeedTransferPolicy<Method> extends true
		? {
				arguments: (
					...args: Parameters<Method>
				) => readonly APITransferable[];
			}
		: {
				arguments?: (
					...args: Parameters<Method>
				) => readonly APITransferable[];
			}) &
		(ResultNeedsTransferPolicy<Method> extends true
			? {
					result: (
						value: Awaited<ReturnType<Method>>
					) => readonly APITransferable[];
				}
			: {
					result?: (
						value: Awaited<ReturnType<Method>>
					) => readonly APITransferable[];
				});

/** Follow nested API objects until the policy reaches an actual method. */
type TransferPolicyNode<Value> = Value extends AnyMethod
	? MethodTransferPolicy<Value>
	: Value extends object
		? APITransferPolicy<Value>
		: never;

/**
 * Decide whether a method or any method below a nested API object requires a
 * policy. This is used to make the corresponding policy property mandatory.
 */
type RequiresTransferPolicy<Value> = Value extends AnyMethod
	? ArgumentsNeedTransferPolicy<Value> extends true
		? true
		: ResultNeedsTransferPolicy<Value>
	: Value extends object
		? true extends {
				[Key in keyof Value]-?: RequiresTransferPolicy<Value[Key]>;
			}[keyof Value]
			? true
			: false
		: false;

/**
 * Per-method transfer rules for values that structured clone can only carry
 * when their nested transferables are included in the postMessage() transfer
 * list. Nested objects mirror nested API method paths.
 *
 * The required-policy check detects nested MessagePorts only. They cannot be
 * structured-cloned without transfer, so a missing hook is unambiguously an
 * error. Other transferable types remain optional because transferring them
 * may change ownership semantics; for example, transferring an ArrayBuffer
 * detaches it from the sender.
 *
 * Detection follows statically visible object properties and the element types
 * of arrays, maps, and sets. It cannot inspect `any`, `unknown`, runtime-only
 * values, custom containers whose contents are absent from their public
 * TypeScript shape, or MessagePorts present only in a non-final overload.
 * Extremely large types are also subject to TypeScript's type-instantiation
 * limit. Declare an optional hook explicitly for any such shape that may
 * contain transferables.
 *
 * This analysis only decides whether TypeScript requires a hook. At runtime no
 * object tree is traversed: the hook alone returns the exact transfer list.
 */
export type APITransferPolicy<API> = {
	[Key in keyof API as RequiresTransferPolicy<API[Key]> extends true
		? Key
		: never]-?: TransferPolicyNode<API[Key]>;
} & {
	[Key in keyof API as RequiresTransferPolicy<API[Key]> extends true
		? never
		: Key]?: TransferPolicyNode<API[Key]>;
};

/**
 * Define a reusable transfer policy with contextual types for every hook.
 *
 * This is intentionally an identity function at runtime. Its purpose is to
 * make TypeScript check the policy against an API contract while preserving
 * readable callback parameter types at the declaration site.
 */
export function defineAPITransferPolicy<API>(
	policy: APITransferPolicy<API>
): APITransferPolicy<API> {
	return policy;
}

/**
 * Make exposeAPI() require its policy argument when the exposed contract
 * contains a statically visible nested MessagePort.
 */
type TransferPolicyArgument<API> =
	RequiresTransferPolicy<API> extends true
		? [transferPolicy: APITransferPolicy<API>]
		: [transferPolicy?: APITransferPolicy<API>];

/**
 * Describes lifecycle information that the transport cannot discover itself.
 *
 * Node.js workers, child processes, and MessagePorts expose lifecycle events,
 * so consumeAPI() observes them automatically. Web Workers do not have a
 * standard event for normal termination, and a MessagePort may be backed by a
 * worker whose lifecycle is managed elsewhere. In those cases, provide the
 * authoritative termination promise here.
 */
export interface ConsumeAPIOptions {
	endpointTerminated?: PromiseLike<unknown>;
}

type ConsumeAPIArguments<API> =
	RequiresTransferPolicy<API> extends true
		? [transferPolicy: APITransferPolicy<API>, options?: ConsumeAPIOptions]
		: [
				transferPolicy?: APITransferPolicy<API>,
				options?: ConsumeAPIOptions,
			];

type ExposedAPIContract<Methods, PipedAPI> = Methods &
	([PipedAPI] extends [undefined] ? unknown : PipedAPI);

/**
 * Raised when a remote call cannot finish because its worker, process, or
 * MessagePort terminated.
 */
export class RemoteAPIEndpointTerminatedError extends Error {
	constructor(cause?: unknown) {
		super(
			'The remote API endpoint terminated before the operation completed.',
			{
				cause,
			}
		);
		this.name = 'RemoteAPIEndpointTerminatedError';
	}
}

// A proxy answers every property access, so no duck-typed property check can
// distinguish it from an endpoint reliably. Track the proxies we create by
// identity instead.
const consumedAPIProxies = new WeakSet<object>();

/**
 * Consume an API whose calls must block the current thread until the remote
 * side responds.
 *
 * This variant is used for synchronous facilities such as file locking and
 * therefore accepts only a real MessagePort, never another Comlink proxy.
 */
export async function consumeAPISync<APIType>(
	remote: IsomorphicMessagePort
): Promise<APIType> {
	assertIsMessagePort(remote, 'consumeAPISync');
	setupTransferHandlers();
	const transport = await NodeSABSyncReceiveMessageTransport.create();
	const api = Comlink.wrapSync<APIType>(remote, transport);
	consumedAPIProxies.add(api as object);
	return api;
}

/**
 * Reject anything that isn't a real MessagePort before we wrap it.
 *
 * A synchronous Comlink proxy answers *every* property access with a proxied
 * function, so it duck-types as an endpoint: `postMessage` and
 * `addEventListener` both look present. Passing one here therefore used to
 * succeed, and only failed on the first method call — as a 5 second
 * "Timeout waiting for response", on another thread, under load. That is how
 * a spawned PHP process silently lost its file lock manager.
 *
 * @see https://github.com/WordPress/wordpress-playground/issues/3783
 */
function assertIsMessagePort(
	remote: IsomorphicMessagePort,
	callerName: string
): void {
	const value = remote as unknown;
	if (
		((typeof value === 'object' && value !== null) ||
			typeof value === 'function') &&
		consumedAPIProxies.has(value as object)
	) {
		throw new TypeError(
			`${callerName}() expects a MessagePort but received a Comlink ` +
				`proxy. Expose the API on a fresh MessageChannel and pass one ` +
				`of its ports instead of passing the proxy itself.`
		);
	}
	if (
		remote === null ||
		typeof remote !== 'object' ||
		typeof remote.postMessage !== 'function'
	) {
		throw new TypeError(
			`${callerName}() expects a MessagePort but received ` +
				`${remote === null ? 'null' : typeof remote}.`
		);
	}
}

/**
 * Consume a remote API. APIs with statically visible nested MessagePorts
 * require an APITransferPolicy as the third argument.
 */
export function consumeAPI<APIType>(
	remote: Worker | Window | NodeWorker | NodeProcess,
	context: undefined | EventTarget = undefined,
	...consumeArguments: ConsumeAPIArguments<APIType>
): RemoteAPI<APIType> {
	setupTransferHandlers();
	const [transferPolicy, options] = consumeArguments;
	const endpointLifecycle = observeEndpointLifecycle(
		remote,
		options?.endpointTerminated
	);

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
	} else if (remote instanceof Worker) {
		endpoint = remote;
	} else {
		const windowEndpoint = Comlink.windowEndpoint(
			remote as Window,
			context
		);
		const bootstrapApi = Comlink.wrap<WithAPIState>(windowEndpoint);
		endpoint = deferredEndpoint(
			connectWindowApiThroughMessagePort(bootstrapApi)
		);
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
	const policyAwareApi = applyArgumentTransferPolicy(api, transferPolicy);
	const lifecycleAwareApi = endpointLifecycle
		? applyEndpointLifecycle(policyAwareApi, endpointLifecycle)
		: policyAwareApi;
	const methods = proxyClone(api);
	const remoteAPI = new Proxy(methods, {
		get: (target, prop) => {
			if (prop === releaseProxy) {
				return () => {
					endpointLifecycle?.dispose();
					return policyAwareApi[prop]();
				};
			}
			if (prop === 'isConnected') {
				return async () => {
					// Keep retrying until the remote API confirms it's connected.
					while (true) {
						try {
							const connectionAttempt = runWithTimeout(
								api.isConnected(),
								200
							);
							await (endpointLifecycle
								? completeBeforeEndpointTerminates(
										connectionAttempt,
										endpointLifecycle
									)
								: connectionAttempt);
							break;
						} catch (error) {
							if (endpointLifecycle?.terminated) {
								throw error;
							}
							// Timeout exceeded, try again. We can't just use a single
							// `runWithTimeout` call because it won't reach the remote API
							// if it's not connected yet. Instead, we need to keep retrying
							// until the remote API is connected and registers a handler
							// for the `isConnected` method.
						}
					}
				};
			}
			return lifecycleAwareApi[prop];
		},
	}) as unknown as RemoteAPI<APIType>;
	consumedAPIProxies.add(remoteAPI);
	return remoteAPI;
}

/**
 * Moves a Window-backed API onto a point-to-point MessagePort.
 *
 * Unlike Worker messages, Window messages are visible to the application's main
 * world and to browser-extension isolated worlds. In Chromium, a browser extension
 * listener that evaluates `event.data` first can take ownership of a transferred
 * ReadableStream before Comlink receives it. Evernote Web Clipper 7.41.1 is one
 * such extension.
 *
 * The Window message used here transfers only Comlink's endpoint port. Later API
 * calls and streams use that port, where unrelated Window listeners cannot
 * observe them. The handshake is retried because `consumeAPI()` may run before
 * the remote Window installs its Comlink listener.
 */
async function connectWindowApiThroughMessagePort(
	bootstrapApi: Remote<WithAPIState> & ProxyMethods
): Promise<MessagePort> {
	while (true) {
		try {
			await runWithTimeout(bootstrapApi.isConnected(), 200);
			return await bootstrapApi[createEndpoint]();
		} catch {
			// The remote Window has not exposed its API yet, or it changed
			// before the endpoint request completed.
		}
	}
}

/**
 * Adapts the asynchronous MessagePort handshake to `consumeAPI()`'s synchronous
 * return type.
 *
 * Comlink starts registering listeners and posting requests immediately. Buffer
 * those operations until the port arrives, then attach and start the listeners
 * before replaying requests so no response can arrive without a listener.
 */
function deferredEndpoint(portPromise: Promise<MessagePort>): Endpoint {
	let port: MessagePort | undefined;
	let shouldStart = false;
	const listeners: Array<{
		type: string;
		listener: EventListenerOrEventListenerObject;
		options?: object;
	}> = [];
	const messages: Array<{
		message: unknown;
		transfer?: Transferable[];
	}> = [];

	void portPromise.then((connectedPort) => {
		port = connectedPort;
		for (const { type, listener, options } of listeners) {
			port.addEventListener(type, listener, options);
		}
		if (shouldStart) {
			port.start();
		}
		for (const { message, transfer } of messages) {
			if (transfer) {
				port.postMessage(message, transfer);
			} else {
				port.postMessage(message);
			}
		}
		messages.length = 0;
	});

	return {
		postMessage(message, transfer) {
			if (port) {
				if (transfer) {
					port.postMessage(message, transfer);
				} else {
					port.postMessage(message);
				}
			} else {
				messages.push({ message, transfer });
			}
		},
		addEventListener(type, listener, options) {
			if (port) {
				port.addEventListener(type, listener, options);
			} else {
				listeners.push({ type, listener, options });
			}
		},
		removeEventListener(type, listener, options) {
			if (port) {
				port.removeEventListener(type, listener, options);
				return;
			}
			const index = listeners.findIndex(
				(entry) =>
					entry.type === type &&
					entry.listener === listener &&
					entry.options === options
			);
			if (index !== -1) {
				listeners.splice(index, 1);
			}
		},
		start() {
			if (port) {
				port.start();
			} else {
				shouldStart = true;
			}
		},
	};
}

async function runWithTimeout<T>(
	promise: Promise<T>,
	timeout: number
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timeoutId = setTimeout(reject, timeout);
		promise.then(
			(value) => {
				clearTimeout(timeoutId);
				resolve(value);
			},
			(error) => {
				clearTimeout(timeoutId);
				reject(error);
			}
		);
	});
}

export type PublicAPI<Methods, PipedAPI = unknown> = RemoteAPI<
	Methods & PipedAPI
>;

/**
 * Expose local methods and an optional piped API. Contracts with statically
 * visible nested MessagePorts require an APITransferPolicy as the fourth
 * argument.
 */
export function exposeAPI<Methods, PipedAPI>(
	apiMethods?: Methods,
	pipedApi?: PipedAPI,
	targetWorker?: MessagePort | NodeWorker | NodeProcess,
	...transferPolicyArgument: TransferPolicyArgument<
		ExposedAPIContract<Methods, PipedAPI>
	>
): [() => void, (e: Error) => void, PublicAPI<Methods, PipedAPI>] {
	const { setReady, setFailed, exposedApi } = prepareForExpose(
		apiMethods,
		pipedApi,
		transferPolicyArgument[0]
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

type RuntimeMethodTransferPolicy = {
	arguments?: (...args: any[]) => readonly APITransferable[];
	result?: (value: any) => readonly APITransferable[];
};

/**
 * Wrap only the consumer-side methods named by a transfer policy.
 *
 * The wrapper asks the policy for the exact nested transferables before each
 * call. It does not inspect or recursively traverse argument values at runtime.
 */
function applyArgumentTransferPolicy(
	api: any,
	policy: APITransferPolicy<any> | undefined
): any {
	if (!policy) {
		return api;
	}

	return new Proxy(api, {
		get(target, property) {
			const value = target[property];
			const policyNode =
				typeof property === 'string'
					? (policy as Record<string, unknown>)[property]
					: undefined;
			if (!isRuntimeMethodTransferPolicy(policyNode)) {
				return policyNode && isObjectLike(value)
					? applyArgumentTransferPolicy(
							value,
							policyNode as APITransferPolicy<any>
						)
					: value;
			}
			if (!policyNode.arguments || typeof value !== 'function') {
				return value;
			}
			return (...args: any[]) => {
				const transferables = policyNode.arguments!(...args);
				return value(
					...attachTransferablesToFirstArgument(args, transferables)
				);
			};
		},
	});
}

type EndpointLifecycle = {
	readonly failure: Promise<never>;
	readonly terminated: boolean;
	dispose(): void;
};

type EndpointTerminationObserver = {
	readonly terminated: Promise<unknown>;
	dispose(): void;
};

/**
 * Reject every call made through a Comlink proxy when its endpoint terminates.
 *
 * Comlink proxies are also used for nested properties and remote value reads,
 * so this wrapper must preserve both property and function proxy traps. A
 * regular object clone would turn those nested proxies into plain functions.
 */
function applyEndpointLifecycle(api: any, lifecycle: EndpointLifecycle): any {
	const wrappedValues = new WeakMap<object, object>();
	return wrapValue(api);

	function wrapValue(value: any): any {
		if (!isObjectLike(value)) {
			return value;
		}
		const existing = wrappedValues.get(value);
		if (existing) {
			return existing;
		}

		const wrapped = new Proxy(value, {
			get(target, property, receiver) {
				const propertyValue = Reflect.get(target, property, receiver);
				if (property === releaseProxy || !isObjectLike(propertyValue)) {
					return propertyValue;
				}
				if (
					property === 'then' &&
					typeof propertyValue === 'function'
				) {
					return (
						onFulfilled: (resolved: unknown) => unknown,
						onRejected: (error: unknown) => unknown
					) => {
						const remoteValue = new Promise((resolve, reject) => {
							Reflect.apply(propertyValue, target, [
								resolve,
								reject,
							]);
						});
						return completeBeforeEndpointTerminates(
							remoteValue,
							lifecycle
						)
							.then((resolved) =>
								protectEndpointResult(resolved, lifecycle)
							)
							.then(onFulfilled, onRejected);
					};
				}
				return wrapValue(propertyValue);
			},
			apply(target, thisArgument, argumentsList) {
				const operation = Reflect.apply(
					target as (...args: any[]) => unknown,
					thisArgument,
					argumentsList
				);
				return completeBeforeEndpointTerminates(
					operation,
					lifecycle
				).then((result) => protectEndpointResult(result, lifecycle));
			},
		});
		wrappedValues.set(value, wrapped);
		return wrapped;
	}
}

/**
 * Keep asynchronous resources returned by a completed API call tied to the
 * endpoint that owns them. The call itself may finish before a streamed PHP
 * response has produced its output or exit code.
 */
function protectEndpointResult(
	result: unknown,
	lifecycle: EndpointLifecycle
): unknown {
	if (result instanceof StreamedPHPResponse) {
		return new StreamedPHPResponse(
			interruptStreamWhenEndpointTerminates(
				result.getHeadersStream(),
				lifecycle
			),
			interruptStreamWhenEndpointTerminates(result.stdout, lifecycle),
			interruptStreamWhenEndpointTerminates(result.stderr, lifecycle),
			completeBeforeEndpointTerminates(result.exitCode, lifecycle)
		);
	}
	if (
		typeof ReadableStream !== 'undefined' &&
		result instanceof ReadableStream
	) {
		return interruptStreamWhenEndpointTerminates(result, lifecycle);
	}
	return result;
}

/**
 * Turn endpoint termination into a stream error instead of leaving a read
 * pending forever.
 */
function interruptStreamWhenEndpointTerminates<T>(
	stream: ReadableStream<T>,
	lifecycle: EndpointLifecycle
): ReadableStream<T> {
	const reader = stream.getReader();
	return new ReadableStream<T>({
		async pull(controller) {
			try {
				const next = await completeBeforeEndpointTerminates(
					reader.read(),
					lifecycle
				);
				if (next.done) {
					controller.close();
				} else {
					controller.enqueue(next.value);
				}
			} catch (error) {
				controller.error(error);
				await reader.cancel(error).catch(() => {
					// The endpoint may already have closed the source stream.
				});
			}
		},
		cancel(reason) {
			return reader.cancel(reason);
		},
	});
}

/**
 * Race one operation against the endpoint lifecycle shared by the whole proxy.
 */
function completeBeforeEndpointTerminates<T>(
	operation: T | PromiseLike<T>,
	lifecycle: EndpointLifecycle
): Promise<T> {
	return Promise.race([Promise.resolve(operation), lifecycle.failure]);
}

/**
 * Combine a caller-provided lifecycle signal with lifecycle events available
 * on Node.js workers, child processes, and MessagePorts.
 */
function observeEndpointLifecycle(
	remote: Worker | Window | NodeWorker | NodeProcess,
	providedTermination: PromiseLike<unknown> | undefined
): EndpointLifecycle | undefined {
	const automaticObserver = observeNodeEndpointTermination(remote);
	const terminationSignals: Promise<unknown>[] = [];
	if (providedTermination) {
		terminationSignals.push(
			Promise.resolve(providedTermination).then(
				(value) => value,
				(error) => error
			)
		);
	}
	if (automaticObserver) {
		terminationSignals.push(automaticObserver.terminated);
	}
	if (terminationSignals.length === 0) {
		return undefined;
	}

	let terminated = false;
	const termination = Promise.race(terminationSignals);
	const failure = termination.then((cause): never => {
		terminated = true;
		automaticObserver?.dispose();
		throw new RemoteAPIEndpointTerminatedError(cause);
	});
	// The lifecycle may end while no API call is pending. Observe the shared
	// rejection here; individual calls still receive it through Promise.race().
	void failure.catch(() => undefined);

	return {
		failure,
		get terminated() {
			return terminated;
		},
		dispose() {
			automaticObserver?.dispose();
		},
	};
}

/**
 * Observe normal endpoint termination where Node.js exposes a reliable event.
 *
 * Browser Worker has no equivalent normal-termination event. Callers managing
 * one must provide ConsumeAPIOptions.endpointTerminated.
 */
function observeNodeEndpointTermination(
	remote: Worker | Window | NodeWorker | NodeProcess
): EndpointTerminationObserver | undefined {
	const candidate = remote as any;
	if (
		typeof candidate.send === 'function' &&
		typeof candidate.addListener === 'function' &&
		typeof candidate.removeListener === 'function'
	) {
		return observeEmitterTermination(candidate, [
			'disconnect',
			'exit',
			'close',
		]);
	}
	if (
		typeof candidate.on !== 'function' ||
		typeof candidate.off !== 'function'
	) {
		return undefined;
	}
	if (typeof candidate.terminate === 'function') {
		return observeEmitterTermination(candidate, ['exit']);
	}
	if (
		typeof candidate.close === 'function' &&
		typeof candidate.start === 'function'
	) {
		return observeEmitterTermination(candidate, ['close']);
	}
	return undefined;
}

/**
 * Resolve on the first lifecycle event and detach every remaining listener.
 */
function observeEmitterTermination(
	emitter: {
		on(event: string, listener: (...args: any[]) => void): void;
		off(event: string, listener: (...args: any[]) => void): void;
	},
	events: string[]
): EndpointTerminationObserver {
	let disposed = false;
	const listeners = new Map<string, (...args: any[]) => void>();
	let resolveTermination!: (reason: unknown) => void;
	const terminated = new Promise<unknown>((resolve) => {
		resolveTermination = resolve;
	});

	for (const event of events) {
		const listener = (...args: any[]) => {
			dispose();
			resolveTermination({ event, args });
		};
		listeners.set(event, listener);
		emitter.on(event, listener);
	}

	return { terminated, dispose };

	function dispose(): void {
		if (disposed) {
			return;
		}
		disposed = true;
		for (const [event, listener] of listeners) {
			emitter.off(event, listener);
		}
		listeners.clear();
	}
}

/**
 * Put all argument transferables into one Comlink envelope.
 *
 * Comlink serializes arguments separately but posts them in one message, so
 * attaching the combined transfer list to the first argument is sufficient.
 */
function attachTransferablesToFirstArgument(
	args: any[],
	transferables: readonly APITransferable[]
): any[] {
	if (transferables.length === 0) {
		return args;
	}
	if (args.length === 0) {
		throw new TypeError(
			'An API argument transfer policy returned transferables for a ' +
				'method with no arguments.'
		);
	}
	// Comlink serializes each argument separately but combines their transfer
	// lists in one postMessage() call. One envelope can therefore carry every
	// transferable referenced anywhere in the complete argument list.
	const wrappedArgs = [...args];
	wrappedArgs[0] = createAPITransferEnvelope(wrappedArgs[0], transferables);
	return wrappedArgs;
}

/** Distinguish method policy leaves from nested policy objects at runtime. */
function isRuntimeMethodTransferPolicy(
	value: unknown
): value is RuntimeMethodTransferPolicy {
	return (
		isObjectLike(value) &&
		(typeof (value as RuntimeMethodTransferPolicy).arguments ===
			'function' ||
			typeof (value as RuntimeMethodTransferPolicy).result === 'function')
	);
}

/** Return true for values that JavaScript Proxy can wrap. */
function isObjectLike(value: unknown): value is object {
	return (
		(typeof value === 'object' && value !== null) ||
		typeof value === 'function'
	);
}

/**
 * Expose a synchronous API over a MessagePort.
 *
 * Synchronous APIs currently do not use nested transfer policies because their
 * shared-memory transport serves the file-locking use case.
 */
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

/**
 * Build the API object shared by asynchronous and synchronous exposure.
 *
 * Besides the caller's methods, every exposed API reports connection and
 * initialization state. Transfer policies are applied before Comlink receives
 * the object so result envelopes are created on the exposing side.
 */
function prepareForExpose<Methods, PipedAPI>(
	apiMethods?: Methods,
	pipedApi?: PipedAPI,
	transferPolicy?: APITransferPolicy<any>
) {
	setupTransferHandlers();

	const connected = Promise.resolve();

	let setReady: any;
	let setFailed: any;
	const ready = new Promise((resolve, reject) => {
		setReady = resolve;
		setFailed = reject;
	});

	const methods = proxyClone(apiMethods, transferPolicy);
	const pipedMethods = pipedApi
		? applyResultTransferPolicy(pipedApi, transferPolicy)
		: pipedApi;
	const exposedApi = new Proxy(methods, {
		get: (target, prop) => {
			if (prop === 'isConnected') {
				return () => connected;
			} else if (prop === 'isReady') {
				return () => ready;
			} else if (prop in target) {
				return target[prop];
			}
			return (pipedMethods as any)?.[prop];
		},
	}) as unknown as PublicAPI<Methods, PipedAPI>;

	return { setReady, setFailed, exposedApi };
}

/**
 * Preserve the Comlink proxy's property traps except at method paths whose
 * results have an explicit transfer policy. In particular, remote value
 * properties are thenable Comlink proxies; recursively cloning every property
 * turns those proxies into plain functions and breaks property reads.
 */
function applyResultTransferPolicy(
	api: any,
	policy: APITransferPolicy<any> | undefined
): any {
	if (!policy) {
		return api;
	}

	return new Proxy(api, {
		get(target, property) {
			const value = target[property];
			const policyNode =
				typeof property === 'string'
					? (policy as Record<string, unknown>)[property]
					: undefined;
			if (!isRuntimeMethodTransferPolicy(policyNode)) {
				return policyNode && isObjectLike(value)
					? applyResultTransferPolicy(
							value,
							policyNode as APITransferPolicy<any>
						)
					: value;
			}
			if (!policyNode.result || typeof value !== 'function') {
				return value;
			}
			return (...args: any[]) =>
				Promise.resolve(value(...args)).then((result) =>
					createAPITransferEnvelope(
						result,
						policyNode.result!(result)
					)
				);
		},
	});
}

const apiTransferMarker = Symbol('php-wasm-api-transfer');
const apiTransferHandlerName = 'PHP_WASM_API_TRANSFER';

type APITransferEnvelope = {
	[apiTransferMarker]: true;
	value: unknown;
	transferables: readonly APITransferable[];
};

type SerializedAPITransferEnvelope = {
	handler?: string;
	value: unknown;
};

/**
 * Mark a value for the custom transfer handler without changing its
 * structured-cloned shape on the receiving side.
 */
function createAPITransferEnvelope(
	value: unknown,
	transferables: readonly APITransferable[]
): APITransferEnvelope {
	return {
		[apiTransferMarker]: true,
		value,
		transferables,
	};
}

let isTransferHandlersSetup = false;

/**
 * Register php-wasm's Comlink transfer handlers once per JavaScript realm.
 *
 * The API envelope handler delegates normal serialization to any existing
 * handler, then adds the policy-provided nested transferables to its list.
 */
function setupTransferHandlers() {
	if (isTransferHandlersSetup) {
		return;
	}
	isTransferHandlersSetup = true;
	Comlink.transferHandlers.set(apiTransferHandlerName, {
		canHandle: (value): value is APITransferEnvelope =>
			isObjectLike(value) && apiTransferMarker in value,
		serialize(
			envelope: APITransferEnvelope
		): [SerializedAPITransferEnvelope, Transferable[]] {
			// Preserve any top-level Comlink serialization that the value would
			// normally receive, then add the API policy's nested transferables.
			for (const [name, handler] of Comlink.transferHandlers) {
				if (
					name === apiTransferHandlerName ||
					!handler.canHandle(envelope.value)
				) {
					continue;
				}
				const [value, automaticallyTransferred] = handler.serialize(
					envelope.value as never
				);
				return [
					{ handler: name, value },
					deduplicateTransferables([
						...automaticallyTransferred,
						...toComlinkTransferables(envelope.transferables),
					]),
				];
			}
			return [
				{ value: envelope.value },
				deduplicateTransferables(
					toComlinkTransferables(envelope.transferables)
				),
			];
		},
		deserialize(envelope: SerializedAPITransferEnvelope): unknown {
			if (!envelope.handler) {
				return envelope.value;
			}
			const handler = Comlink.transferHandlers.get(envelope.handler);
			if (!handler) {
				throw new TypeError(
					`Unknown Comlink transfer handler "${envelope.handler}".`
				);
			}
			return handler.deserialize(envelope.value as never);
		},
	});
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
	type SerializedReadableStream = {
		stream?: ReadableStream<Uint8Array>;
		port?: MessagePort;
	};
	/**
	 * Keeps the stream live while it crosses the Comlink boundary. Runtimes without
	 * transferable stream support use the existing MessagePort bridge.
	 */
	const readableStreamTransferHandler: Comlink.TransferHandler<
		ReadableStream<Uint8Array>,
		SerializedReadableStream
	> = {
		canHandle: (obj: unknown): obj is ReadableStream<Uint8Array> =>
			typeof ReadableStream !== 'undefined' &&
			obj instanceof ReadableStream,
		serialize(
			stream: ReadableStream<Uint8Array>
		): [SerializedReadableStream, Transferable[]] {
			if (supportsTransferableStreams()) {
				return [{ stream }, [stream as unknown as Transferable]];
			}

			const port = streamToPort(stream);
			return [{ port }, [port]];
		},
		deserialize(
			data: SerializedReadableStream
		): ReadableStream<Uint8Array> {
			return data.stream || portToStream(data.port!);
		},
	};
	Comlink.transferHandlers.set(
		'READABLE_STREAM',
		readableStreamTransferHandler
	);
	type SerializedEventWithReadableStdin = {
		type: string;
		stdin: SerializedReadableStream;
	};
	/**
	 * Transfers a worker event explicitly branded with `phpEventStdinTransfer`.
	 * Comlink applies a transfer handler to the top-level value only, so it will not
	 * discover the nested `stdin` stream on its own.
	 */
	const eventWithReadableStdinTransferHandler: Comlink.TransferHandler<
		PHPEventWithStdinTransfer,
		SerializedEventWithReadableStdin
	> = {
		canHandle: (obj: unknown): obj is PHPEventWithStdinTransfer =>
			typeof obj === 'object' &&
			obj !== null &&
			phpEventStdinTransfer in obj &&
			obj[phpEventStdinTransfer] === true &&
			'type' in obj &&
			typeof obj.type === 'string' &&
			'stdin' in obj &&
			readableStreamTransferHandler.canHandle(obj.stdin),
		serialize(event): [SerializedEventWithReadableStdin, Transferable[]] {
			const [stdin, transferables] =
				readableStreamTransferHandler.serialize(event.stdin);
			return [{ ...event, stdin }, transferables];
		},
		deserialize(event): PHPEventWithStdinTransfer {
			// Symbol properties are not structured-cloned. Restore the brand locally.
			return {
				...event,
				stdin: readableStreamTransferHandler.deserialize(event.stdin),
				[phpEventStdinTransfer]: true,
			};
		},
	};
	Comlink.transferHandlers.set(
		'EVENT_WITH_READABLE_STDIN',
		eventWithReadableStdinTransferHandler
	);
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
 * Safari does not support transferable streams. Use the MessagePort bridge when
 * this point-to-point capability probe fails.
 */
let _cachedSupportsTransferableStreams: boolean | undefined;
function supportsTransferableStreams(): boolean {
	if (typeof ReadableStream === 'undefined') {
		_cachedSupportsTransferableStreams = false;
	}
	if (_cachedSupportsTransferableStreams === undefined) {
		try {
			const { port1 } = new MessageChannel();
			const rs = new ReadableStream();
			port1.postMessage(rs, [rs as unknown as Transferable]);
			try {
				port1.close();
			} catch (_e) {
				void _e;
			}
			_cachedSupportsTransferableStreams = true;
		} catch (_e) {
			void _e;
			_cachedSupportsTransferableStreams = false;
		}
	}
	return _cachedSupportsTransferableStreams;
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
 *   { t: 'cancel' }                – consumer cancelled the stream
 */
export function streamToPort(stream: ReadableStream<Uint8Array>): MessagePort {
	const { port1, port2 } = new MessageChannel();
	const reader = stream.getReader();
	const onMessage = (event: MessageEvent) => {
		if (event.data?.t === 'cancel') {
			reader.cancel().catch(() => {
				// The consumer has already cancelled and cannot observe source errors.
			});
		}
	};
	port1.addEventListener('message', onMessage);
	port1.start();
	(async () => {
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
					/**
					 * ReadableStream.tee() gives each branch the same chunk object. Transfer
					 * an owned copy so detaching this buffer does not invalidate another
					 * listener's branch.
					 */
					const owned = value.slice();
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
			port1.removeEventListener('message', onMessage);
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
export function portToStream(port: MessagePort): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			const onMessage = (ev: MessageEvent) => {
				const data: any = (ev as any).data;
				if (!data) return;
				switch (data.t) {
					case 'chunk':
						try {
							controller.enqueue(new Uint8Array(data.b));
						} catch {
							// enqueue() throws when the stream is no
							// longer readable — the consumer cancelled
							// it, someone called controller.error(),
							// or the stream was already closed. We
							// swallow the error because the consumer
							// already knows why the stream ended. The
							// only actionable response is to close
							// the port so the remote side stops
							// sending.
							cleanup();
						}
						break;
					case 'close':
						safeStreamClose(controller);
						cleanup();
						break;
					case 'error':
						safeStreamError(
							controller,
							new Error(data.m || 'Stream error')
						);
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
				port.postMessage({ t: 'cancel' });
			} catch {
				// The producer has already closed its port.
			}
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

/**
 * Preserve the existing behavior of exposed API objects while adding result
 * transfer envelopes at policy-selected method paths.
 *
 * Plain objects are cloned lazily so nested methods keep their receiver. Values
 * that need Comlink proxy semantics continue to use Comlink.proxy().
 */
function proxyClone(object: any, transferPolicy?: APITransferPolicy<any>): any {
	return new Proxy(object, {
		get(target, prop) {
			const policyNode =
				typeof prop === 'string'
					? (transferPolicy as Record<string, unknown> | undefined)?.[
							prop
						]
					: undefined;
			if (
				policyNode &&
				!isRuntimeMethodTransferPolicy(policyNode) &&
				isObjectLike(target[prop])
			) {
				return proxyClone(
					target[prop],
					policyNode as APITransferPolicy<any>
				);
			}
			switch (typeof target[prop]) {
				case 'function':
					return (...args: any[]) => {
						const result = target[prop](...args);
						if (
							!isRuntimeMethodTransferPolicy(policyNode) ||
							!policyNode.result
						) {
							return result;
						}
						return Promise.resolve(result).then((value) =>
							createAPITransferEnvelope(
								value,
								policyNode.result!(value)
							)
						);
					};
				case 'object':
					if (target[prop] === null) {
						return target[prop];
					}
					return proxyClone(
						target[prop],
						policyNode as APITransferPolicy<any> | undefined
					);
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

/** Include each transferable only once in the final postMessage() list. */
function deduplicateTransferables(
	transferables: Transferable[]
): Transferable[] {
	return Array.from(new Set(transferables));
}

/**
 * Convert the isomorphic public type to Comlink's DOM transfer-list type.
 *
 * Node accepts additional worker_threads transferables at runtime even though
 * Comlink's TypeScript definitions use the browser Transferable type.
 */
function toComlinkTransferables(
	transferables: readonly APITransferable[]
): Transferable[] {
	return transferables as readonly Transferable[] as Transferable[];
}

/**
 * Calls controller.error() without throwing if the stream is
 * already closed or errored. We swallow the error because the
 * consumer already has the terminal state — re-throwing would
 * crash the Node process for no benefit.
 */
function safeStreamError(
	controller: ReadableStreamDefaultController,
	error: unknown
) {
	try {
		controller.error(error);
	} catch {
		// Stream already in a terminal state.
	}
}

/**
 * Calls controller.close() without throwing if the stream is
 * already closed or errored. We swallow the error because the
 * consumer already has the terminal state — re-throwing would
 * crash the Node process for no benefit.
 */
function safeStreamClose(controller: ReadableStreamDefaultController) {
	try {
		controller.close();
	} catch {
		// Stream already in a terminal state.
	}
}
