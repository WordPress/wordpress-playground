/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import {
	phpEventStdinTransfer,
	type PHPEventWithStdinTransfer,
} from '@php-wasm/util';
import { PHPResponse, StreamedPHPResponse } from './php-response';
import {
	RPC_PROTOCOL_MARKER,
	RPC_PROTOCOL_VERSION,
	RPCProtocolVersionMismatchError,
	RPCSerializationError,
	RPCUnsupportedOperationError,
	RPCUnsupportedTransferError,
	RemoteAPIEndpointTerminatedError,
	SyncRPCOperationTimeoutError,
	createRPCEndpointAdapter,
	createRPCClient,
	createSyncRPCClient,
	exposeRPC,
	exposeSyncRPC,
	isArrayBufferValue,
	isRPCRemoteProxy,
	isReadableStreamValue,
	isUint8ArrayValue,
	releaseApiProxy,
	reserveRPCEndpoint,
	type EncodedRPCCodecValue,
	type Remote,
	type RPCClientOptions,
	type RPCClosablePort,
	type RPCCodecContext,
	type RPCEndpointAdapter,
	type RPCPath,
	type RPCResourceOwner,
	type RPCTransferPolicy,
	type RPCValueCodec,
	type RPCWireValue,
	type SyncRPCClientOptions,
} from './rpc';
import type { NodeProcess } from './rpc-node-process-adapter';

export type { NodeProcess } from './rpc-node-process-adapter';

export {
	RPC_PROTOCOL_MARKER,
	RPC_PROTOCOL_VERSION,
	RPCProtocolVersionMismatchError,
	RPCSerializationError,
	RPCUnsupportedOperationError,
	RPCUnsupportedTransferError,
	RemoteAPIEndpointTerminatedError,
	SyncRPCOperationTimeoutError,
	releaseApiProxy,
};
export type { Remote } from './rpc';

export type WithAPIState = {
	/** Resolves after the versioned RPC handshake succeeds. */
	isConnected: () => Promise<void>;
	/** Resolves after the exposing side declares the API ready. */
	isReady: () => Promise<void>;
};

export type WithIsReady = WithAPIState;

export type RemoteAPI<T> = Remote<T> & WithAPIState;
export type PublicAPI<Methods, PipedAPI = unknown> = RemoteAPI<
	Methods & PipedAPI
>;

export type APITransferable = Transferable;

export interface APITransferPolicy<API = unknown> extends RPCTransferPolicy {
	transferArguments?(
		path: RPCPath,
		args: readonly unknown[]
	): readonly APITransferable[];
	transferResult?(path: RPCPath, result: unknown): readonly APITransferable[];
	/** Type-only anchor for the API associated with this policy. */
	readonly __apiType?: API;
}

export interface ConsumeAPIOptions {
	/** Event context retained for the positional Window compatibility overload. */
	context?: EventTarget;
	/** One owner-controlled signal for the complete endpoint lifetime. */
	signal?: AbortSignal;
	/** Exact origin used for the Window bootstrap postMessage(). */
	targetOrigin?: string;
	/** Transfer hooks for nested method arguments. */
	transferPolicy?: APITransferPolicy;
	/** Select native stream transfer, the portable port bridge, or feature detection. */
	streamTransport?: 'auto' | 'native' | 'message-port';
	/** Handshake retry cadence. Primarily useful for deterministic tests. */
	handshakeRetryMs?: number;
}

export interface ExposeAPIOptions {
	/** One owner-controlled signal for the complete exposed endpoint lifetime. */
	signal?: AbortSignal;
	/** Transfer hooks for nested method results. */
	transferPolicy?: APITransferPolicy;
	/** Exact origins accepted by an iframe's Window bootstrap listener. */
	allowedOrigins?: string | readonly string[];
	/** Expected bootstrap sender. Defaults to the iframe's parent Window. */
	parentWindow?: Window;
	/** Select native stream transfer, the portable port bridge, or feature detection. */
	streamTransport?: 'auto' | 'native' | 'message-port';
}

export type ConsumeAPISyncOptions = SyncRPCClientOptions;

/** Browser and node:worker_threads MessagePorts share this RPC-facing shape. */
export interface IsomorphicMessagePort {
	postMessage: (...args: any[]) => unknown;
	addEventListener?: (
		type: string,
		listener: (...args: any[]) => void
	) => unknown;
	removeEventListener?: (
		type: string,
		listener: (...args: any[]) => void
	) => unknown;
	on?: (type: string, listener: (...args: any[]) => void) => unknown;
	off?: (type: string, listener: (...args: any[]) => void) => unknown;
	addListener?: (type: string, listener: (...args: any[]) => void) => unknown;
	removeListener?: (
		type: string,
		listener: (...args: any[]) => void
	) => unknown;
	start?: () => void;
	close?: () => void;
}

const policiesByAPI = new WeakMap<object, APITransferPolicy>();

export function defineAPITransferPolicy<Policy extends APITransferPolicy>(
	policy: Policy
): Policy;
export function defineAPITransferPolicy<API extends object>(
	api: API,
	policy: APITransferPolicy<API>
): API;
export function defineAPITransferPolicy(
	apiOrPolicy: object,
	policy?: APITransferPolicy
): object {
	if (policy === undefined) {
		assertTransferPolicy(apiOrPolicy as APITransferPolicy);
		return apiOrPolicy;
	}
	assertTransferPolicy(policy);
	policiesByAPI.set(apiOrPolicy, policy);
	return apiOrPolicy;
}

export async function consumeAPISync<APIType>(
	remote: IsomorphicMessagePort,
	options: ConsumeAPISyncOptions = {}
): Promise<APIType> {
	return await createSyncRPCClient<APIType>(remote, options);
}

export function consumeAPI<APIType>(
	remote: Worker | Window | MessagePort | object | NodeProcess,
	contextOrOptions?: EventTarget | ConsumeAPIOptions,
	additionalOptions: ConsumeAPIOptions = {}
): RemoteAPI<APIType> {
	const options = normalizeConsumeOptions(
		contextOrOptions,
		additionalOptions
	);
	const codecs = createPlaygroundCodecs(options.streamTransport || 'auto');
	let endpoint: RPCEndpointAdapter;

	if (isWindowEndpoint(remote)) {
		const targetOrigin =
			options.targetOrigin ||
			inferWindowTargetOrigin(remote, options.context);
		endpoint = createWindowBootstrapEndpoint(remote, targetOrigin);
	} else {
		reserveRPCEndpoint(remote, 'asynchronous RPC consumption');
		endpoint = createRPCEndpointAdapter(remote, {
			ownsTarget: isMessagePort(remote),
		});
	}

	const clientOptions: RPCClientOptions = {
		signal: options.signal,
		transferPolicy: options.transferPolicy,
		handshakeRetryMs: options.handshakeRetryMs,
	};
	return createRPCClient<APIType & WithAPIState>(
		endpoint,
		codecs,
		clientOptions
	) as RemoteAPI<APIType>;
}

export function exposeAPI<Methods, PipedAPI = unknown>(
	apiMethods?: Methods,
	pipedApi?: PipedAPI,
	targetWorker?: MessagePort | object | NodeProcess,
	options: ExposeAPIOptions = {}
): [() => void, (error: Error) => void, PublicAPI<Methods, PipedAPI>] {
	const { setReady, setFailed, exposedApi } = prepareForExpose(
		apiMethods,
		pipedApi
	);
	const transferPolicy =
		options.transferPolicy || getDefinedTransferPolicy(apiMethods);
	const codecs = createPlaygroundCodecs(options.streamTransport || 'auto');

	if (targetWorker !== undefined) {
		if (isWindowEndpoint(targetWorker)) {
			throw new TypeError(
				'Window exposure requires the private iframe bootstrap; ' +
					'do not pass a Window as the explicit endpoint.'
			);
		}
		reserveRPCEndpoint(targetWorker, 'asynchronous RPC exposure');
		exposeRPC(
			exposedApi,
			createRPCEndpointAdapter(targetWorker, {
				ownsTarget: isMessagePort(targetWorker),
			}),
			codecs,
			{
				signal: options.signal,
				transferPolicy,
			}
		);
	} else if (isIframeWindowRealm()) {
		installWindowBootstrap(exposedApi, codecs, {
			...options,
			transferPolicy,
		});
	} else {
		const workerGlobal = globalThis as unknown as object;
		if (isWindowEndpoint(workerGlobal)) {
			throw new TypeError(
				'Top-level Window exposure is unsupported; use an iframe ' +
					'with a private bootstrap port.'
			);
		}
		reserveRPCEndpoint(workerGlobal, 'asynchronous RPC exposure');
		exposeRPC(exposedApi, createRPCEndpointAdapter(workerGlobal), codecs, {
			signal: options.signal,
			transferPolicy,
		});
	}

	return [setReady, setFailed, exposedApi as PublicAPI<Methods, PipedAPI>];
}

export async function exposeSyncAPI<Methods>(
	apiMethods: Methods,
	port: IsomorphicMessagePort,
	options: { signal?: AbortSignal } = {}
): Promise<[() => void, (error: Error) => void, Methods]> {
	const { setReady, setFailed, exposedApi } = prepareForExpose(apiMethods);
	exposeSyncRPC(exposedApi, port, options);
	return [setReady, setFailed, exposedApi as Methods];
}

function prepareForExpose<Methods, PipedAPI>(
	apiMethods?: Methods,
	pipedApi?: PipedAPI
): {
	setReady: () => void;
	setFailed: (error: Error) => void;
	exposedApi: Methods & PipedAPI & WithAPIState;
} {
	let readyState: 'pending' | 'resolved' | 'rejected' = 'pending';
	let resolveReady!: () => void;
	let rejectReady!: (error: Error) => void;
	const ready = new Promise<void>((resolve, reject) => {
		resolveReady = resolve;
		rejectReady = reject;
	});
	void ready.catch(() => {});

	const setReady = () => {
		if (readyState !== 'pending') return;
		readyState = 'resolved';
		resolveReady();
	};
	const setFailed = (error: Error) => {
		if (readyState !== 'pending') return;
		readyState = 'rejected';
		rejectReady(error);
	};
	const apiIsRemote = isRPCRemoteProxy(apiMethods);
	const pipedIsRemote = isRPCRemoteProxy(pipedApi);

	const exposedApi = new Proxy(Object.create(null), {
		get(_target, property) {
			if (property === 'isConnected') {
				return async () => {};
			}
			if (property === 'isReady') {
				return () => ready;
			}
			const direct = getCompositeProperty(
				apiMethods,
				property,
				apiIsRemote
			);
			if (direct.found) {
				return apiIsRemote
					? direct.value
					: bindCompositeMethod(direct.value, apiMethods);
			}
			const piped = getCompositeProperty(
				pipedApi,
				property,
				pipedIsRemote
			);
			return piped.found
				? pipedIsRemote
					? piped.value
					: bindCompositeMethod(piped.value, pipedApi)
				: undefined;
		},
		has(_target, property) {
			return (
				property === 'isConnected' ||
				property === 'isReady' ||
				apiIsRemote ||
				hasProperty(apiMethods, property) ||
				pipedIsRemote ||
				hasProperty(pipedApi, property)
			);
		},
	}) as Methods & PipedAPI & WithAPIState;

	return { setReady, setFailed, exposedApi };
}

function getCompositeProperty(
	object: unknown,
	property: string | symbol,
	assumePresent = false
): { found: boolean; value?: unknown } {
	if (
		object === null ||
		object === undefined ||
		(!assumePresent && !hasProperty(object, property))
	) {
		return { found: false };
	}
	return {
		found: true,
		value: Reflect.get(Object(object), property, object),
	};
}

function hasProperty(object: unknown, property: string | symbol): boolean {
	return (
		object !== null && object !== undefined && property in Object(object)
	);
}

function bindCompositeMethod(value: unknown, owner: unknown): unknown {
	if (typeof value !== 'function') {
		return value;
	}
	return (...args: unknown[]) => Reflect.apply(value, owner, args);
}

function normalizeConsumeOptions(
	contextOrOptions: EventTarget | ConsumeAPIOptions | undefined,
	additionalOptions: ConsumeAPIOptions
): ConsumeAPIOptions {
	if (isEventTarget(contextOrOptions)) {
		return {
			...additionalOptions,
			context: contextOrOptions,
		};
	}
	return {
		...(contextOrOptions || {}),
		...additionalOptions,
	};
}

function isEventTarget(value: unknown): value is EventTarget {
	return (
		typeof value === 'object' &&
		value !== null &&
		'addEventListener' in value &&
		typeof value.addEventListener === 'function' &&
		!('targetOrigin' in value) &&
		!('signal' in value)
	);
}

function assertTransferPolicy(policy: APITransferPolicy): void {
	if (
		policy.transferArguments !== undefined &&
		typeof policy.transferArguments !== 'function'
	) {
		throw new TypeError('transferArguments must be a function.');
	}
	if (
		policy.transferResult !== undefined &&
		typeof policy.transferResult !== 'function'
	) {
		throw new TypeError('transferResult must be a function.');
	}
}

function getDefinedTransferPolicy(
	value: unknown
): APITransferPolicy | undefined {
	return (typeof value === 'object' && value !== null) ||
		typeof value === 'function'
		? policiesByAPI.get(value)
		: undefined;
}

const RPC_BOOTSTRAP_MARKER = 'wordpress-playground-rpc-bootstrap';

interface WindowBootstrapEnvelope {
	protocol: typeof RPC_BOOTSTRAP_MARKER;
	version: number;
	kind: 'connect';
	session: string;
}

function createWindowBootstrapEndpoint(
	remoteWindow: Window,
	targetOrigin: string
): RPCEndpointAdapter {
	assertExactOrigin(targetOrigin);
	const messageListeners = new Set<(message: unknown) => void>();
	const terminationListeners = new Set<
		(reason: string, cause?: unknown) => void
	>();
	const attempts = new Set<{
		port: MessagePort;
		cleanup: () => void;
	}>();
	let activePort: MessagePort | undefined;
	let closed = false;

	const closeAttempts = (except?: MessagePort) => {
		for (const attempt of [...attempts]) {
			if (attempt.port === except) continue;
			attempt.cleanup();
			attempts.delete(attempt);
		}
	};

	const beginAttempt = (hello: unknown) => {
		if (closed || activePort || !isClientHello(hello)) return;
		const channel = new MessageChannel();
		const port = channel.port1;
		const removeMessage = addPortMessageListener(port, (message) => {
			if (activePort === port) {
				for (const listener of messageListeners) listener(message);
				return;
			}
			if (!isSessionBootstrapResponse(message, hello.session)) return;
			activePort = port;
			closeAttempts(port);
			for (const listener of messageListeners) listener(message);
		});
		const removeClose = addPortCloseListener(port, () => {
			if (activePort === port && !closed) {
				for (const listener of terminationListeners) {
					listener('private-message-port-closed');
				}
			}
		});
		const attempt = {
			port,
			cleanup: () => {
				clearTimeout(expiration);
				removeMessage();
				removeClose();
				safeClosePort(port);
			},
		};
		attempts.add(attempt);
		port.start();
		const expiration = setTimeout(() => {
			if (activePort !== port) {
				attempt.cleanup();
				attempts.delete(attempt);
			}
		}, 2_000);
		try {
			remoteWindow.postMessage(
				{
					protocol: RPC_BOOTSTRAP_MARKER,
					version: RPC_PROTOCOL_VERSION,
					kind: 'connect',
					session: hello.session,
				} satisfies WindowBootstrapEnvelope,
				targetOrigin,
				[channel.port2]
			);
			port.postMessage(hello);
		} catch (error) {
			attempt.cleanup();
			attempts.delete(attempt);
			for (const listener of terminationListeners) {
				listener('window-bootstrap-failed', error);
			}
		}
	};

	return {
		type: 'window-private-message-port',
		supportsTransfers: true,
		postMessage(message, transferables = []) {
			if (closed) {
				throw new RemoteAPIEndpointTerminatedError(
					'The Window RPC bootstrap endpoint is closed.',
					{
						endpointType: 'window-private-message-port',
						reason: 'closed',
					}
				);
			}
			if (!activePort) {
				beginAttempt(message);
				return;
			}
			if (transferables.length > 0) {
				activePort.postMessage(message, [...transferables]);
			} else {
				activePort.postMessage(message);
			}
		},
		listen(listener) {
			messageListeners.add(listener);
			return () => messageListeners.delete(listener);
		},
		listenForTermination(listener) {
			terminationListeners.add(listener);
			return () => terminationListeners.delete(listener);
		},
		start() {},
		close() {
			if (closed) return;
			closed = true;
			closeAttempts();
			if (activePort) safeClosePort(activePort);
			activePort = undefined;
			messageListeners.clear();
			terminationListeners.clear();
		},
	};
}

function installWindowBootstrap(
	exposedApi: unknown,
	codecs: readonly RPCValueCodec[],
	options: ExposeAPIOptions & { transferPolicy?: APITransferPolicy }
): void {
	const currentWindow = window;
	const expectedSource = options.parentWindow || currentWindow.parent;
	const allowedOrigins = resolveAllowedOrigins(options.allowedOrigins);
	const sessions = new Set<{
		closed: Promise<void>;
		terminate(error?: Error): void;
	}>();

	const onMessage = (event: MessageEvent) => {
		if (
			event.source !== expectedSource ||
			!allowedOrigins.has(event.origin) ||
			!isWindowBootstrapEnvelope(event.data) ||
			event.ports.length !== 1
		) {
			return;
		}
		const port = event.ports[0];
		if (event.data.version !== RPC_PROTOCOL_VERSION) {
			port.postMessage({
				protocol: RPC_PROTOCOL_MARKER,
				version: RPC_PROTOCOL_VERSION,
				session: event.data.session,
				kind: 'protocol-error',
				remoteVersion: RPC_PROTOCOL_VERSION,
				message:
					`Unsupported Window bootstrap protocol version ` +
					`${event.data.version}.`,
			});
			port.close();
			return;
		}
		reserveRPCEndpoint(port, 'private Window RPC exposure');
		const session = exposeRPC(
			exposedApi,
			createRPCEndpointAdapter(port, { ownsTarget: true }),
			codecs,
			{
				signal: options.signal,
				transferPolicy: options.transferPolicy,
				expectedSessionId: event.data.session,
			}
		);
		sessions.add(session);
		void session.closed.then(() => sessions.delete(session));
	};

	currentWindow.addEventListener('message', onMessage);
	if (options.signal) {
		const cleanup = () => {
			currentWindow.removeEventListener('message', onMessage);
			for (const session of sessions) session.terminate();
			sessions.clear();
		};
		if (options.signal.aborted) cleanup();
		else options.signal.addEventListener('abort', cleanup, { once: true });
	}
}

function isWindowBootstrapEnvelope(
	value: unknown
): value is WindowBootstrapEnvelope {
	return (
		typeof value === 'object' &&
		value !== null &&
		'protocol' in value &&
		value.protocol === RPC_BOOTSTRAP_MARKER &&
		'version' in value &&
		typeof value.version === 'number' &&
		'kind' in value &&
		value.kind === 'connect' &&
		'session' in value &&
		typeof value.session === 'string' &&
		value.session.length >= 8 &&
		value.session.length <= 200
	);
}

function isClientHello(
	value: unknown
): value is { session: string; kind: 'hello' } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'protocol' in value &&
		value.protocol === RPC_PROTOCOL_MARKER &&
		'kind' in value &&
		value.kind === 'hello' &&
		'session' in value &&
		typeof value.session === 'string'
	);
}

function isSessionBootstrapResponse(value: unknown, session: string): boolean {
	if (
		!(
			typeof value === 'object' &&
			value !== null &&
			'protocol' in value &&
			value.protocol === RPC_PROTOCOL_MARKER &&
			'session' in value &&
			value.session === session &&
			'kind' in value
		)
	) {
		return false;
	}
	if (value.kind === 'hello-ack') {
		return 'version' in value && value.version === RPC_PROTOCOL_VERSION;
	}
	return (
		value.kind === 'protocol-error' &&
		'version' in value &&
		typeof value.version === 'number' &&
		Number.isSafeInteger(value.version) &&
		'remoteVersion' in value &&
		typeof value.remoteVersion === 'number' &&
		Number.isSafeInteger(value.remoteVersion)
	);
}

function resolveAllowedOrigins(
	configured: string | readonly string[] | undefined
): Set<string> {
	const values =
		configured === undefined
			? [inferParentOrigin()]
			: typeof configured === 'string'
				? [configured]
				: [...configured];
	const origins = new Set<string>();
	for (const origin of values) {
		assertExactOrigin(origin);
		origins.add(origin);
	}
	return origins;
}

function inferParentOrigin(): string {
	if (document.referrer) {
		return new URL(document.referrer).origin;
	}
	if (window.parent === window) {
		return window.location.origin;
	}
	throw new Error(
		'Cannot infer the parent origin. Configure exposeAPI({ allowedOrigins }) ' +
			'when the iframe referrer is suppressed.'
	);
}

function inferWindowTargetOrigin(
	remoteWindow: Window,
	context: EventTarget | undefined
): string {
	if (isWindowObject(context)) {
		try {
			for (const iframe of Array.from(
				context.document.querySelectorAll('iframe')
			)) {
				if (iframe.contentWindow === remoteWindow) {
					return new URL(iframe.src, context.document.baseURI).origin;
				}
			}
		} catch {
			// Continue to the same-origin probe below.
		}
	}
	try {
		return remoteWindow.location.origin;
	} catch {
		throw new Error(
			'consumeAPI() requires options.targetOrigin for a cross-origin Window.'
		);
	}
}

function assertExactOrigin(origin: string): void {
	if (origin === 'null') {
		throw new TypeError(
			'Opaque Window origins are not supported for RPC bootstrap.'
		);
	}
	if (origin === '*') {
		throw new TypeError(
			'Wildcard origins are not allowed for RPC bootstrap.'
		);
	}
	let parsed: URL;
	try {
		parsed = new URL(origin);
	} catch (cause) {
		throw new TypeError(`Invalid RPC origin "${origin}".`, { cause });
	}
	if (parsed.origin !== origin || parsed.pathname !== '/') {
		throw new TypeError(
			`RPC origin must be an exact origin without a path: "${origin}".`
		);
	}
}

function isIframeWindowRealm(): boolean {
	return (
		typeof window !== 'undefined' &&
		typeof document !== 'undefined' &&
		window.parent !== window
	);
}

function isWindowEndpoint(value: unknown): value is Window {
	if (typeof value !== 'object' || value === null) return false;
	if (typeof Window !== 'undefined') {
		try {
			if (value instanceof Window) return true;
		} catch {
			// Cross-origin Window proxies may reject reflective access.
		}
	}
	const candidate = value as {
		window?: unknown;
		postMessage?: unknown;
		closed?: unknown;
	};
	try {
		if (candidate.window === value) return true;
	} catch {
		// Continue with the cross-origin-accessible Window properties below.
	}
	try {
		return (
			typeof candidate.postMessage === 'function' &&
			typeof candidate.closed === 'boolean'
		);
	} catch {
		return false;
	}
}

function isWindowObject(value: unknown): value is Window {
	if (typeof Window === 'undefined') return false;
	try {
		return value instanceof Window;
	} catch {
		return false;
	}
}

function isMessagePort(value: unknown): value is MessagePort {
	return (
		typeof value === 'object' &&
		value !== null &&
		value.constructor?.name === 'MessagePort' &&
		'postMessage' in value &&
		typeof value.postMessage === 'function' &&
		'close' in value &&
		typeof value.close === 'function'
	);
}

type StreamTransportPreference = NonNullable<
	ConsumeAPIOptions['streamTransport']
>;

type EncodedReadableStream =
	| {
			transport: 'native';
			stream: ReadableStream<Uint8Array>;
	  }
	| {
			transport: 'message-port';
			port: MessagePort;
			channel: string;
	  };

function createPlaygroundCodecs(
	streamTransport: StreamTransportPreference
): readonly RPCValueCodec[] {
	const readableStreamCodec = createReadableStreamCodec(streamTransport);
	return [
		createPHPEventWithStdinCodec(streamTransport),
		createStreamedPHPResponseCodec(streamTransport),
		createPHPResponseCodec(),
		createCustomEventCodec(),
		createCallbackCodec(),
		createMessagePortCodec(),
		readableStreamCodec,
		createErrorValueCodec(),
	];
}

function createCallbackCodec(): RPCValueCodec {
	return {
		id: 'playground.callback.v1',
		canEncode: (value) => typeof value === 'function',
		encode(value, context) {
			return {
				value: {
					callbackId: context.registerCallback(
						value as (...args: any[]) => unknown
					),
				},
				transferables: [],
			};
		},
		decode(value, context) {
			if (
				typeof value !== 'object' ||
				value === null ||
				!('callbackId' in value) ||
				typeof value.callbackId !== 'string'
			) {
				throw new RPCSerializationError(
					'Invalid callback codec payload.'
				);
			}
			return context.getCallbackProxy(value.callbackId);
		},
	};
}

function createCustomEventCodec(): RPCValueCodec {
	return {
		id: 'playground.custom-event.v1',
		canEncode(value) {
			return (
				typeof CustomEvent !== 'undefined' &&
				value instanceof CustomEvent
			);
		},
		encode(value, context) {
			const event = value as CustomEvent;
			const detail = context.encode(event.detail);
			return {
				value: {
					type: event.type,
					detail: detail.wire,
					bubbles: event.bubbles,
					cancelable: event.cancelable,
					composed: event.composed,
				},
				transferables: detail.transferables,
			};
		},
		decode(value, context) {
			if (
				typeof value !== 'object' ||
				value === null ||
				!('type' in value) ||
				typeof value.type !== 'string' ||
				!('detail' in value)
			) {
				throw new RPCSerializationError(
					'Invalid CustomEvent codec payload.'
				);
			}
			const detail = context.decode(value.detail as RPCWireValue);
			if (typeof CustomEvent !== 'undefined') {
				return new CustomEvent(value.type, {
					detail,
					bubbles: Boolean('bubbles' in value && value.bubbles),
					cancelable: Boolean(
						'cancelable' in value && value.cancelable
					),
					composed: Boolean('composed' in value && value.composed),
				});
			}
			return { type: value.type, detail };
		},
	};
}

function createMessagePortCodec(): RPCValueCodec {
	return {
		id: 'playground.message-port.v1',
		canEncode: isMessagePort,
		encode(value, context) {
			assertTransfersSupported(context.resources);
			return {
				value,
				transferables: [value as Transferable],
			};
		},
		decode(value, context) {
			if (!isMessagePort(value)) {
				throw new RPCSerializationError(
					'Invalid MessagePort codec payload.'
				);
			}
			context.resources.trackPort(value);
			return value;
		},
	};
}

function createReadableStreamCodec(
	preference: StreamTransportPreference
): RPCValueCodec {
	return {
		id: 'playground.readable-stream.v1',
		canEncode: isReadableStream,
		encode(value, context) {
			return encodeReadableStream(
				value as ReadableStream<Uint8Array>,
				context.resources,
				preference
			);
		},
		decode(value, context) {
			return decodeReadableStream(value, context.resources);
		},
	};
}

function createPHPEventWithStdinCodec(
	preference: StreamTransportPreference
): RPCValueCodec {
	return {
		id: 'playground.php-event-stdin.v1',
		canEncode(value): value is PHPEventWithStdinTransfer {
			return (
				typeof value === 'object' &&
				value !== null &&
				phpEventStdinTransfer in value &&
				value[phpEventStdinTransfer] === true &&
				'type' in value &&
				typeof value.type === 'string' &&
				'stdin' in value &&
				isReadableStream(value.stdin)
			);
		},
		encode(value, context) {
			const event = value as PHPEventWithStdinTransfer &
				Record<string, unknown>;
			const stdin = encodeReadableStream(
				event.stdin,
				context.resources,
				preference
			);
			const properties: Record<string, unknown> = {};
			for (const property of Object.keys(event)) {
				if (property !== 'stdin')
					properties[property] = event[property];
			}
			return {
				value: {
					properties,
					stdin: stdin.value,
				},
				transferables: stdin.transferables,
			};
		},
		decode(value, context) {
			if (
				typeof value !== 'object' ||
				value === null ||
				!('properties' in value) ||
				typeof value.properties !== 'object' ||
				value.properties === null ||
				!('stdin' in value)
			) {
				throw new RPCSerializationError(
					'Invalid PHP event codec payload.'
				);
			}
			return {
				...(value.properties as Record<string, unknown>),
				stdin: decodeReadableStream(value.stdin, context.resources),
				[phpEventStdinTransfer]: true,
			};
		},
	};
}

function createPHPResponseCodec(): RPCValueCodec {
	return {
		id: 'playground.php-response.v1',
		canEncode: (value) => value instanceof PHPResponse,
		encode(value, context) {
			const response = value as PHPResponse;
			const data = response.toRawData();
			const transferables: Transferable[] = [];
			if (
				isArrayBufferValue(data.bytes.buffer) &&
				data.bytes.buffer.byteLength > 0
			) {
				assertTransfersSupported(context.resources);
				transferables.push(data.bytes.buffer);
			}
			return { value: data, transferables };
		},
		decode(value) {
			if (!isPHPResponseData(value)) {
				throw new RPCSerializationError(
					'Invalid PHPResponse codec payload.'
				);
			}
			return PHPResponse.fromRawData(value);
		},
	};
}

function createStreamedPHPResponseCodec(
	preference: StreamTransportPreference
): RPCValueCodec {
	return {
		id: 'playground.streamed-php-response.v1',
		canEncode: (value) => value instanceof StreamedPHPResponse,
		encode(value, context) {
			assertTransfersSupported(context.resources);
			const response = value as StreamedPHPResponse;
			const headers = encodeReadableStream(
				response.getHeadersStream(),
				context.resources,
				preference
			);
			const stdout = encodeReadableStream(
				response.stdout,
				context.resources,
				preference
			);
			const stderr = encodeReadableStream(
				response.stderr,
				context.resources,
				preference
			);
			const exitCodePort = promiseToPort(
				response.exitCode,
				context.resources
			);
			return {
				value: {
					headers: headers.value,
					stdout: stdout.value,
					stderr: stderr.value,
					exitCodePort,
				},
				transferables: [
					...headers.transferables,
					...stdout.transferables,
					...stderr.transferables,
					exitCodePort,
				],
			};
		},
		decode(value, context) {
			if (
				typeof value !== 'object' ||
				value === null ||
				!('headers' in value) ||
				!('stdout' in value) ||
				!('stderr' in value) ||
				!('exitCodePort' in value) ||
				!isMessagePort(value.exitCodePort)
			) {
				throw new RPCSerializationError(
					'Invalid StreamedPHPResponse codec payload.'
				);
			}
			return new StreamedPHPResponse(
				decodeReadableStream(value.headers, context.resources),
				decodeReadableStream(value.stdout, context.resources),
				decodeReadableStream(value.stderr, context.resources),
				portToPromise<number>(value.exitCodePort, context.resources)
			);
		},
	};
}

interface SerializedErrorValue {
	name: string;
	message: string;
	stack?: string;
	originalClassName: string;
	cause?: SerializedErrorNestedValue;
	properties: Record<string, SerializedErrorNestedValue>;
}

type SerializedErrorNestedValue =
	| { kind: 'error'; value: SerializedErrorValue }
	| { kind: 'value'; value: RPCWireValue };

function createErrorValueCodec(): RPCValueCodec {
	return {
		id: 'playground.error-value.v1',
		canEncode: (value) => value instanceof Error,
		encode(value, context) {
			return encodeErrorValue(value as Error, context, new Set());
		},
		decode(value, context) {
			return decodeErrorValue(value, context);
		},
	};
}

function encodeErrorValue(
	error: Error,
	context: RPCCodecContext,
	seen: Set<Error>
): EncodedRPCCodecValue {
	seen.add(error);
	const transferables: Transferable[] = [];
	let cause: SerializedErrorNestedValue | undefined;
	if (error.cause !== undefined) {
		const encodedCause = encodeErrorNested(error.cause, context, seen);
		cause = encodedCause.value;
		transferables.push(...encodedCause.transferables);
	}
	const properties: Record<string, SerializedErrorNestedValue> = {};
	for (const property of Object.getOwnPropertyNames(error)) {
		if (
			property === 'name' ||
			property === 'message' ||
			property === 'stack' ||
			property === 'cause' ||
			property === '__proto__' ||
			property === 'prototype' ||
			property === 'constructor'
		) {
			continue;
		}
		const descriptor = Object.getOwnPropertyDescriptor(error, property);
		if (!descriptor || !('value' in descriptor)) continue;
		const encoded = encodeErrorNested(descriptor.value, context, seen);
		properties[property] = encoded.value;
		transferables.push(...encoded.transferables);
	}
	return {
		value: {
			name: error.name,
			message: error.message,
			stack: error.stack,
			originalClassName: error.constructor?.name || 'Error',
			cause,
			properties,
		} satisfies SerializedErrorValue,
		transferables,
	};
}

function encodeErrorNested(
	value: unknown,
	context: RPCCodecContext,
	seen: Set<Error>
): { value: SerializedErrorNestedValue; transferables: Transferable[] } {
	if (value instanceof Error) {
		if (seen.has(value)) {
			const circular = context.encode('[Circular error reference]');
			return {
				value: { kind: 'value', value: circular.wire },
				transferables: circular.transferables,
			};
		}
		const encoded = encodeErrorValue(value, context, new Set(seen));
		return {
			value: {
				kind: 'error',
				value: encoded.value as SerializedErrorValue,
			},
			transferables: encoded.transferables,
		};
	}
	const encoded = context.encode(value);
	return {
		value: { kind: 'value', value: encoded.wire },
		transferables: encoded.transferables,
	};
}

function decodeErrorValue(value: unknown, context: RPCCodecContext): Error {
	if (!isSerializedErrorValue(value)) {
		throw new RPCSerializationError('Invalid Error value codec payload.');
	}
	const error = new Error(value.message);
	error.name = value.name;
	if (value.stack !== undefined) error.stack = value.stack;
	if (value.cause !== undefined) {
		error.cause = decodeErrorNested(value.cause, context);
	}
	Object.defineProperty(error, 'originalErrorClassName', {
		configurable: true,
		enumerable: true,
		writable: true,
		value: value.originalClassName,
	});
	for (const [property, nested] of Object.entries(value.properties)) {
		if (
			property === '__proto__' ||
			property === 'prototype' ||
			property === 'constructor'
		) {
			continue;
		}
		Object.defineProperty(error, property, {
			configurable: true,
			enumerable: true,
			writable: true,
			value: decodeErrorNested(nested, context),
		});
	}
	return error;
}

function decodeErrorNested(
	value: SerializedErrorNestedValue,
	context: RPCCodecContext
): unknown {
	return value.kind === 'error'
		? decodeErrorValue(value.value, context)
		: context.decode(value.value);
}

function isSerializedErrorValue(value: unknown): value is SerializedErrorValue {
	return (
		typeof value === 'object' &&
		value !== null &&
		'name' in value &&
		typeof value.name === 'string' &&
		'message' in value &&
		typeof value.message === 'string' &&
		'originalClassName' in value &&
		typeof value.originalClassName === 'string' &&
		'properties' in value &&
		typeof value.properties === 'object' &&
		value.properties !== null
	);
}

function isPHPResponseData(
	value: unknown
): value is ReturnType<PHPResponse['toRawData']> {
	return (
		typeof value === 'object' &&
		value !== null &&
		'headers' in value &&
		typeof value.headers === 'object' &&
		'bytes' in value &&
		isUint8ArrayValue(value.bytes) &&
		'errors' in value &&
		typeof value.errors === 'string' &&
		'exitCode' in value &&
		typeof value.exitCode === 'number' &&
		'httpStatusCode' in value &&
		typeof value.httpStatusCode === 'number'
	);
}

function isReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
	return isReadableStreamValue(value);
}

function assertTransfersSupported(resources: RPCResourceOwner): void {
	if (!resources.supportsTransfers) {
		throw new RPCUnsupportedTransferError(resources.endpointType);
	}
}

function encodeReadableStream(
	stream: ReadableStream<Uint8Array>,
	resources: RPCResourceOwner,
	preference: StreamTransportPreference
): EncodedRPCCodecValue {
	assertTransfersSupported(resources);
	const useNative =
		preference === 'native' ||
		(preference === 'auto' && supportsTransferableStreams());
	if (useNative) {
		if (!supportsTransferableStreams()) {
			throw new RPCSerializationError(
				'Native transferable ReadableStreams are unavailable in this runtime.'
			);
		}
		return {
			value: {
				transport: 'native',
				stream,
			} satisfies EncodedReadableStream,
			transferables: [stream as unknown as Transferable],
		};
	}
	const bridge = streamToPortInternal(stream, resources);
	return {
		value: {
			transport: 'message-port',
			port: bridge.port,
			channel: bridge.channelId,
		} satisfies EncodedReadableStream,
		transferables: [bridge.port],
	};
}

function decodeReadableStream(
	value: unknown,
	resources: RPCResourceOwner
): ReadableStream<Uint8Array> {
	if (
		typeof value !== 'object' ||
		value === null ||
		!('transport' in value)
	) {
		throw new RPCSerializationError(
			'Invalid ReadableStream codec payload.'
		);
	}
	if (
		value.transport === 'native' &&
		'stream' in value &&
		isReadableStream(value.stream)
	) {
		return bindStreamToLifetime(value.stream, resources);
	}
	if (
		value.transport === 'message-port' &&
		'port' in value &&
		isMessagePort(value.port) &&
		'channel' in value &&
		typeof value.channel === 'string' &&
		value.channel.length > 0 &&
		value.channel.length <= 200
	) {
		return portToStreamInternal(value.port, resources, value.channel);
	}
	throw new RPCSerializationError(
		'Unknown ReadableStream transport payload.'
	);
}

let cachedTransferableStreams: boolean | undefined;

function supportsTransferableStreams(): boolean {
	if (cachedTransferableStreams !== undefined) {
		return cachedTransferableStreams;
	}
	if (
		typeof ReadableStream === 'undefined' ||
		typeof MessageChannel === 'undefined'
	) {
		cachedTransferableStreams = false;
		return false;
	}
	const channel = new MessageChannel();
	const stream = new ReadableStream({
		start(controller) {
			controller.close();
		},
	});
	try {
		channel.port1.postMessage(stream, [stream as unknown as Transferable]);
		cachedTransferableStreams = true;
	} catch {
		cachedTransferableStreams = false;
	} finally {
		safeClosePort(channel.port1);
		safeClosePort(channel.port2);
	}
	return cachedTransferableStreams;
}

const STREAM_BRIDGE_MARKER = 'wordpress-playground-stream-bridge';
const DEFERRED_BRIDGE_MARKER = 'wordpress-playground-deferred-bridge';
const BRIDGE_PROTOCOL_VERSION = 1;

interface StreamBridgeMessage {
	protocol: typeof STREAM_BRIDGE_MARKER;
	version: number;
	channel: string;
	kind: 'open' | 'chunk' | 'close' | 'error' | 'cancel';
	bytes?: ArrayBuffer;
	error?: SerializedBridgeError;
}

interface DeferredBridgeMessage {
	protocol: typeof DEFERRED_BRIDGE_MARKER;
	version: number;
	channel: string;
	kind: 'resolve' | 'reject';
	value?: unknown;
	error?: SerializedBridgeError;
}

interface SerializedBridgeError {
	name: string;
	message: string;
	stack?: string;
}

export function streamToPort(stream: ReadableStream<Uint8Array>): MessagePort {
	return streamToPortInternal(stream).port;
}

function streamToPortInternal(
	stream: ReadableStream<Uint8Array>,
	resources?: RPCResourceOwner
): { port: MessagePort; channelId: string } {
	const channel = new MessageChannel();
	const channelId = createBridgeId();
	const reader = stream.getReader();
	let settled = false;
	let removeTerminalResource = () => {};

	const cleanup = () => {
		if (settled) return;
		settled = true;
		removeMessage();
		removeClose();
		removeTerminalResource();
		safeClosePort(channel.port1);
	};
	const cancelReader = (reason?: unknown) => {
		void reader.cancel(reason).catch(() => {});
		cleanup();
	};
	const removeMessage = addPortMessageListener(channel.port1, (message) => {
		if (
			isStreamBridgeMessage(message, channelId) &&
			message.kind === 'cancel'
		) {
			cancelReader('The remote stream consumer cancelled the stream.');
		}
	});
	const removeClose = addPortCloseListener(channel.port1, () =>
		cancelReader('The remote stream port closed.')
	);
	if (resources) {
		removeTerminalResource = resources.addTerminalResource((error) =>
			cancelReader(error)
		);
	}
	channel.port1.start();
	postPortMessage(channel.port1, {
		protocol: STREAM_BRIDGE_MARKER,
		version: BRIDGE_PROTOCOL_VERSION,
		channel: channelId,
		kind: 'open',
	});

	void (async () => {
		try {
			while (!settled) {
				const { done, value } = await reader.read();
				if (done) {
					postPortMessage(channel.port1, {
						protocol: STREAM_BRIDGE_MARKER,
						version: BRIDGE_PROTOCOL_VERSION,
						channel: channelId,
						kind: 'close',
					});
					break;
				}
				const ownedBytes = value.slice();
				postPortMessage(
					channel.port1,
					{
						protocol: STREAM_BRIDGE_MARKER,
						version: BRIDGE_PROTOCOL_VERSION,
						channel: channelId,
						kind: 'chunk',
						bytes: ownedBytes.buffer,
					},
					[ownedBytes.buffer]
				);
			}
		} catch (error) {
			if (!settled) {
				try {
					postPortMessage(channel.port1, {
						protocol: STREAM_BRIDGE_MARKER,
						version: BRIDGE_PROTOCOL_VERSION,
						channel: channelId,
						kind: 'error',
						error: serializeBridgeError(error),
					});
				} catch {
					// The peer cannot observe an error after its port closes.
				}
			}
		} finally {
			cleanup();
		}
	})();

	return { port: channel.port2, channelId };
}

export function portToStream(port: MessagePort): ReadableStream<Uint8Array> {
	return portToStreamInternal(port);
}

function portToStreamInternal(
	port: MessagePort,
	resources?: RPCResourceOwner,
	knownChannelId?: string
): ReadableStream<Uint8Array> {
	let channelId = knownChannelId;
	let pendingCancelReason: unknown;
	let hasPendingCancel = false;
	let cancelRemote = (reason: unknown) => {
		pendingCancelReason = reason;
		hasPendingCancel = true;
	};
	return new ReadableStream<Uint8Array>({
		start(controller) {
			let settled = false;
			let removeTerminalResource = () => {};
			const cleanup = () => {
				if (settled) return;
				settled = true;
				removeMessage();
				removeClose();
				removeTerminalResource();
				safeClosePort(port);
			};
			cancelRemote = (reason: unknown) => {
				if (channelId === undefined) {
					pendingCancelReason = reason;
					hasPendingCancel = true;
					return;
				}
				try {
					postPortMessage(port, {
						protocol: STREAM_BRIDGE_MARKER,
						version: BRIDGE_PROTOCOL_VERSION,
						channel: channelId,
						kind: 'cancel',
					});
				} catch {
					void reason;
				}
				cleanup();
			};
			const terminate = (error: unknown) => {
				safeStreamError(controller, error);
				cleanup();
			};
			const removeMessage = addPortMessageListener(port, (message) => {
				if (!isStreamBridgeMessage(message)) return;
				if (channelId === undefined) channelId = message.channel;
				if (message.channel !== channelId) return;
				if (hasPendingCancel) {
					hasPendingCancel = false;
					cancelRemote(pendingCancelReason);
					return;
				}
				switch (message.kind) {
					case 'open':
						break;
					case 'chunk':
						if (!isArrayBufferValue(message.bytes)) {
							terminate(
								new RPCSerializationError(
									'Stream bridge chunk is missing its ArrayBuffer.'
								)
							);
							return;
						}
						try {
							controller.enqueue(new Uint8Array(message.bytes));
						} catch {
							cleanup();
						}
						break;
					case 'close':
						safeStreamClose(controller);
						cleanup();
						break;
					case 'error':
						terminate(deserializeBridgeError(message.error));
						break;
				}
			});
			const removeClose = addPortCloseListener(port, () => {
				if (!settled) {
					terminate(
						new RemoteAPIEndpointTerminatedError(
							'The stream transport port closed before the stream completed.',
							{
								endpointType: 'message-port-stream',
								reason: 'port-closed',
							}
						)
					);
				}
			});
			if (resources) {
				removeTerminalResource =
					resources.addTerminalResource(terminate);
			}
			port.start();
		},
		cancel(reason) {
			cancelRemote(reason);
		},
	});
}

function bindStreamToLifetime(
	stream: ReadableStream<Uint8Array>,
	resources: RPCResourceOwner
): ReadableStream<Uint8Array> {
	const reader = stream.getReader();
	let removeTerminalResource = () => {};
	return new ReadableStream<Uint8Array>({
		start(controller) {
			removeTerminalResource = resources.addTerminalResource((error) => {
				void reader.cancel(error).catch(() => {});
				safeStreamError(controller, error);
			});
		},
		async pull(controller) {
			try {
				const result = await reader.read();
				if (result.done) {
					removeTerminalResource();
					safeStreamClose(controller);
				} else {
					controller.enqueue(result.value);
				}
			} catch (error) {
				removeTerminalResource();
				safeStreamError(controller, error);
			}
		},
		cancel(reason) {
			removeTerminalResource();
			return reader.cancel(reason);
		},
	});
}

function promiseToPort<T>(
	promise: Promise<T>,
	resources?: RPCResourceOwner
): MessagePort {
	const channel = new MessageChannel();
	const channelId = createBridgeId();
	let settled = false;
	let removeTerminalResource = () => {};
	const cleanup = () => {
		if (settled) return;
		settled = true;
		removeTerminalResource();
		safeClosePort(channel.port1);
	};
	if (resources) {
		removeTerminalResource = resources.addTerminalResource(cleanup);
	}
	void promise.then(
		(value) => {
			if (settled) return;
			try {
				postPortMessage(channel.port1, {
					protocol: DEFERRED_BRIDGE_MARKER,
					version: BRIDGE_PROTOCOL_VERSION,
					channel: channelId,
					kind: 'resolve',
					value,
				});
			} finally {
				cleanup();
			}
		},
		(error) => {
			if (settled) return;
			try {
				postPortMessage(channel.port1, {
					protocol: DEFERRED_BRIDGE_MARKER,
					version: BRIDGE_PROTOCOL_VERSION,
					channel: channelId,
					kind: 'reject',
					error: serializeBridgeError(error),
				});
			} finally {
				cleanup();
			}
		}
	);
	return channel.port2;
}

function portToPromise<T>(
	port: MessagePort,
	resources?: RPCResourceOwner
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		let settled = false;
		let channelId: string | undefined;
		let removeTerminalResource = () => {};
		const cleanup = () => {
			if (settled) return;
			settled = true;
			removeMessage();
			removeClose();
			removeTerminalResource();
			safeClosePort(port);
		};
		const removeMessage = addPortMessageListener(port, (message) => {
			if (!isDeferredBridgeMessage(message)) return;
			if (channelId === undefined) channelId = message.channel;
			if (message.channel !== channelId) return;
			cleanup();
			if (message.kind === 'resolve') resolve(message.value as T);
			else reject(deserializeBridgeError(message.error));
		});
		const removeClose = addPortCloseListener(port, () => {
			if (settled) return;
			cleanup();
			reject(
				new RemoteAPIEndpointTerminatedError(
					'The deferred-value port closed before it settled.',
					{
						endpointType: 'message-port-deferred',
						reason: 'port-closed',
					}
				)
			);
		});
		if (resources) {
			removeTerminalResource = resources.addTerminalResource((error) => {
				if (settled) return;
				cleanup();
				reject(error);
			});
		}
		port.start();
	});
}

function isStreamBridgeMessage(
	value: unknown,
	channel?: string
): value is StreamBridgeMessage {
	return (
		typeof value === 'object' &&
		value !== null &&
		'protocol' in value &&
		value.protocol === STREAM_BRIDGE_MARKER &&
		'version' in value &&
		value.version === BRIDGE_PROTOCOL_VERSION &&
		'channel' in value &&
		typeof value.channel === 'string' &&
		value.channel.length > 0 &&
		value.channel.length <= 200 &&
		(channel === undefined || value.channel === channel) &&
		'kind' in value &&
		(value.kind === 'open' ||
			value.kind === 'chunk' ||
			value.kind === 'close' ||
			value.kind === 'error' ||
			value.kind === 'cancel')
	);
}

function isDeferredBridgeMessage(
	value: unknown
): value is DeferredBridgeMessage {
	return (
		typeof value === 'object' &&
		value !== null &&
		'protocol' in value &&
		value.protocol === DEFERRED_BRIDGE_MARKER &&
		'version' in value &&
		value.version === BRIDGE_PROTOCOL_VERSION &&
		'channel' in value &&
		typeof value.channel === 'string' &&
		'kind' in value &&
		(value.kind === 'resolve' || value.kind === 'reject')
	);
}

function serializeBridgeError(value: unknown): SerializedBridgeError {
	if (value instanceof Error) {
		return {
			name: value.name,
			message: value.message,
			stack: value.stack,
		};
	}
	return { name: 'Error', message: String(value) };
}

function deserializeBridgeError(
	value: SerializedBridgeError | undefined
): Error {
	const error = new Error(value?.message || 'Remote stream failed.');
	error.name = value?.name || 'Error';
	if (value?.stack) error.stack = value.stack;
	return error;
}

function createBridgeId(): string {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID();
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function postPortMessage(
	port: MessagePort,
	message: unknown,
	transferables: Transferable[] = []
): void {
	if (transferables.length > 0) port.postMessage(message, transferables);
	else port.postMessage(message);
}

function addPortMessageListener(
	port: MessagePort,
	listener: (message: unknown) => void
): () => void {
	const eventListener = (event: MessageEvent) => listener(event.data);
	port.addEventListener('message', eventListener);
	return () => port.removeEventListener('message', eventListener);
}

function addPortCloseListener(
	port: MessagePort,
	listener: () => void
): () => void {
	port.addEventListener('close', listener);
	return () => port.removeEventListener('close', listener);
}

function safeClosePort(port: RPCClosablePort): void {
	try {
		port.close?.();
	} catch {
		// Cleanup is deliberately idempotent.
	}
}

function safeStreamError(
	controller: ReadableStreamDefaultController,
	error: unknown
): void {
	try {
		controller.error(error);
	} catch {
		// The stream is already closed, errored, or cancelled.
	}
}

function safeStreamClose(controller: ReadableStreamDefaultController): void {
	try {
		controller.close();
	} catch {
		// The stream is already closed, errored, or cancelled.
	}
}
