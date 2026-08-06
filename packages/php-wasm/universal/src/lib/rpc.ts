/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { isNodeProcess, type NodeProcess } from './rpc-node-process-adapter';

export const RPC_PROTOCOL_MARKER = 'wordpress-playground-rpc';
export const RPC_PROTOCOL_VERSION = 1;

export const releaseApiProxy: unique symbol = Symbol(
	'wordpress-playground-rpc.release'
);

const FORBIDDEN_PATH_COMPONENTS = new Set([
	'__proto__',
	'prototype',
	'constructor',
]);
const DEFAULT_HANDSHAKE_RETRY_MS = 200;
const DEFAULT_SYNC_TIMEOUT_MS = 30_000;
const DEFAULT_SYNC_RESPONSE_BYTES = 1024 * 1024;

export type RPCPath = readonly string[];

export class RemoteAPIEndpointTerminatedError extends Error {
	readonly endpointType: string;
	readonly reason: string;

	constructor(
		message = 'The remote API endpoint is no longer available.',
		options: {
			endpointType?: string;
			reason?: string;
			cause?: unknown;
		} = {}
	) {
		super(message);
		this.name = 'RemoteAPIEndpointTerminatedError';
		this.endpointType = options.endpointType || 'unknown';
		this.reason = options.reason || 'terminated';
		if (options.cause !== undefined) {
			this.cause = options.cause;
		}
	}
}

export class RPCProtocolVersionMismatchError extends RemoteAPIEndpointTerminatedError {
	readonly localVersion: number;
	readonly remoteVersion: number;

	constructor(remoteVersion: number, endpointType = 'unknown') {
		super(
			`WordPress Playground RPC protocol version mismatch: local version ` +
				`${RPC_PROTOCOL_VERSION}, remote version ${remoteVersion}.`,
			{
				endpointType,
				reason: 'protocol-version-mismatch',
			}
		);
		this.name = 'RPCProtocolVersionMismatchError';
		this.localVersion = RPC_PROTOCOL_VERSION;
		this.remoteVersion = remoteVersion;
	}
}

export class RPCSerializationError extends Error {
	constructor(message: string, options: { cause?: unknown } = {}) {
		super(message);
		this.name = 'RPCSerializationError';
		if (options.cause !== undefined) {
			this.cause = options.cause;
		}
	}
}

export class RPCUnsupportedTransferError extends RPCSerializationError {
	constructor(endpointType: string) {
		super(
			`The ${endpointType} RPC transport does not support transfer lists.`
		);
		this.name = 'RPCUnsupportedTransferError';
	}
}

export class RPCUnsupportedOperationError extends Error {
	constructor(operation: string) {
		super(
			`Remote ${operation} is not supported by the Playground RPC API.`
		);
		this.name = 'RPCUnsupportedOperationError';
	}
}

export class SyncRPCOperationTimeoutError extends Error {
	readonly timeoutMs: number;

	constructor(timeoutMs: number) {
		super(
			`Synchronous remote API call exceeded its ${timeoutMs}ms deadline.`
		);
		this.name = 'SyncRPCOperationTimeoutError';
		this.timeoutMs = timeoutMs;
	}
}

const remoteProxies = new WeakSet<object>();

export function isRPCRemoteProxy(value: unknown): boolean {
	return (
		((typeof value === 'object' && value !== null) ||
			typeof value === 'function') &&
		remoteProxies.has(value)
	);
}

export interface EncodedRPCValue {
	wire: RPCWireValue;
	transferables: Transferable[];
}

export interface EncodedRPCCodecValue {
	value: unknown;
	transferables: Transferable[];
}

export type RPCWireValue =
	| {
			representation: 'clone';
			value: unknown;
	  }
	| {
			representation: 'codec';
			codec: string;
			value: unknown;
	  };

export interface RPCCodecContext {
	readonly resources: RPCResourceOwner;
	encode(value: unknown): EncodedRPCValue;
	decode(value: RPCWireValue): unknown;
	registerCallback(callback: (...args: any[]) => unknown): string;
	getCallbackProxy(callbackId: string): (...args: any[]) => Promise<unknown>;
}

export interface RPCValueCodec {
	readonly id: string;
	canEncode(value: unknown): boolean;
	encode(value: unknown, context: RPCCodecContext): EncodedRPCCodecValue;
	decode(value: unknown, context: RPCCodecContext): unknown;
}

export interface RPCResourceOwner {
	readonly terminated: boolean;
	readonly terminationError: RemoteAPIEndpointTerminatedError | undefined;
	readonly endpointType: string;
	readonly supportsTransfers: boolean;
	addTerminalResource(
		terminate: (error: RemoteAPIEndpointTerminatedError) => void
	): () => void;
	trackPort(port: RPCClosablePort): void;
}

export interface RPCClosablePort {
	close?: () => void;
}

export interface RPCTransferPolicy {
	transferArguments?(
		path: RPCPath,
		args: readonly unknown[]
	): readonly Transferable[];
	transferResult?(path: RPCPath, result: unknown): readonly Transferable[];
}

export interface RPCClientOptions {
	signal?: AbortSignal;
	transferPolicy?: RPCTransferPolicy;
	handshakeRetryMs?: number;
}

export interface RPCServerOptions {
	signal?: AbortSignal;
	transferPolicy?: RPCTransferPolicy;
	expectedSessionId?: string;
}

export interface SyncRPCClientOptions {
	signal?: AbortSignal;
	timeoutMs?: number;
	maxResponseBytes?: number;
	handshakeTimeoutMs?: number;
}

export interface SyncRPCServerOptions {
	signal?: AbortSignal;
}

export interface RPCEndpointAdapter {
	readonly type: string;
	readonly supportsTransfers: boolean;
	postMessage(
		message: unknown,
		transferables?: readonly Transferable[]
	): void;
	listen(onMessage: (message: unknown) => void): () => void;
	listenForTermination(
		onTerminated: (reason: string, cause?: unknown) => void
	): () => void;
	start(): void;
	close(): void;
}

type EventTargetLike = {
	postMessage: (...args: any[]) => unknown;
	addEventListener: (
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: unknown
	) => void;
	removeEventListener: (
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: unknown
	) => void;
	start?: () => void;
	close?: () => void;
};

type EventEmitterLike = {
	postMessage: (...args: any[]) => unknown;
	on?: (type: string, listener: (...args: any[]) => void) => unknown;
	addListener?: (type: string, listener: (...args: any[]) => void) => unknown;
	off?: (type: string, listener: (...args: any[]) => void) => unknown;
	removeListener?: (
		type: string,
		listener: (...args: any[]) => void
	) => unknown;
	start?: () => void;
	close?: () => void;
};

export function createRPCEndpointAdapter(
	target: unknown,
	options: { ownsTarget?: boolean } = {}
): RPCEndpointAdapter {
	if (isNodeProcess(target)) {
		return createNodeProcessAdapter(target);
	}
	if (!isPostMessageTarget(target)) {
		throw new TypeError(
			'RPC endpoint must provide postMessage() or Node child-process IPC.'
		);
	}

	const type = getEndpointType(target);
	const supportsEventTarget =
		'addEventListener' in target &&
		typeof target.addEventListener === 'function';
	const supportsEventEmitter =
		('on' in target && typeof target.on === 'function') ||
		('addListener' in target && typeof target.addListener === 'function');

	if (!supportsEventTarget && !supportsEventEmitter) {
		throw new TypeError(
			'RPC endpoint must provide EventTarget or EventEmitter listeners.'
		);
	}

	return {
		type,
		supportsTransfers: true,
		postMessage(message, transferables = []) {
			if (transferables.length > 0) {
				target.postMessage(message, transferables);
			} else {
				target.postMessage(message);
			}
		},
		listen(onMessage) {
			if (supportsEventTarget) {
				const eventTarget = target as EventTargetLike;
				const listener = (event: Event) => {
					onMessage((event as MessageEvent).data);
				};
				eventTarget.addEventListener('message', listener);
				return () =>
					eventTarget.removeEventListener('message', listener);
			}

			const emitter = target as EventEmitterLike;
			const listener = (message: unknown) => onMessage(message);
			addEmitterListener(emitter, 'message', listener);
			return () => removeEmitterListener(emitter, 'message', listener);
		},
		listenForTermination(onTerminated) {
			return supportsEventTarget
				? listenForEventTargetTermination(
						target as EventTargetLike,
						type,
						onTerminated
					)
				: listenForEmitterTermination(
						target as EventEmitterLike,
						type,
						onTerminated
					);
		},
		start() {
			(target as EventTargetLike | EventEmitterLike).start?.();
		},
		close() {
			if (options.ownsTarget) {
				try {
					(target as EventTargetLike | EventEmitterLike).close?.();
				} catch {
					// Cleanup is deliberately idempotent.
				}
			}
		},
	};
}

function createNodeProcessAdapter(target: NodeProcess): RPCEndpointAdapter {
	return {
		type: 'node-child-process',
		supportsTransfers: false,
		postMessage(message, transferables = []) {
			if (transferables.length > 0) {
				throw new RPCUnsupportedTransferError('Node child-process IPC');
			}
			if (target.connected === false) {
				throw new RemoteAPIEndpointTerminatedError(
					'The Node child-process IPC channel is disconnected.',
					{
						endpointType: 'node-child-process',
						reason: 'disconnected',
					}
				);
			}
			target.send(message);
		},
		listen(onMessage) {
			const listener = (message: unknown) => onMessage(message);
			target.addListener('message', listener);
			return () => target.removeListener('message', listener);
		},
		listenForTermination(onTerminated) {
			const listeners = [
				['disconnect', () => onTerminated('disconnect')],
				[
					'exit',
					(code: unknown, signal: unknown) =>
						onTerminated(`exit${formatExitDetails(code, signal)}`),
				],
				[
					'close',
					(code: unknown, signal: unknown) =>
						onTerminated(`close${formatExitDetails(code, signal)}`),
				],
				['error', (error: unknown) => onTerminated('error', error)],
			] as const;
			for (const [event, listener] of listeners) {
				target.addListener(event, listener);
			}
			return () => {
				for (const [event, listener] of listeners) {
					target.removeListener(event, listener);
				}
			};
		},
		start() {},
		close() {},
	};
}

function listenForEventTargetTermination(
	target: EventTargetLike,
	type: string,
	onTerminated: (reason: string, cause?: unknown) => void
): () => void {
	const listeners = [
		['messageerror', (event: Event) => onTerminated('messageerror', event)],
		['error', (event: Event) => onTerminated('error', event)],
		['close', () => onTerminated('close')],
	] as const;
	for (const [event, listener] of listeners) {
		target.addEventListener(event, listener);
	}
	return () => {
		for (const [event, listener] of listeners) {
			target.removeEventListener(event, listener);
		}
	};
}

function listenForEmitterTermination(
	target: EventEmitterLike,
	type: string,
	onTerminated: (reason: string, cause?: unknown) => void
): () => void {
	const events = new Map<string, (...args: any[]) => void>();
	const add = (event: string, listener: (...args: any[]) => void) => {
		events.set(event, listener);
		addEmitterListener(target, event, listener);
	};
	add('messageerror', (error) => onTerminated('messageerror', error));
	add('error', (error) => onTerminated('error', error));
	add('close', () => onTerminated('close'));
	if (type === 'node-worker') {
		add('exit', (code) => onTerminated(`exit (code ${String(code)})`));
	}
	return () => {
		for (const [event, listener] of events) {
			removeEmitterListener(target, event, listener);
		}
	};
}

function addEmitterListener(
	target: EventEmitterLike,
	type: string,
	listener: (...args: any[]) => void
) {
	if (target.on) {
		target.on(type, listener);
	} else {
		target.addListener?.(type, listener);
	}
}

function removeEmitterListener(
	target: EventEmitterLike,
	type: string,
	listener: (...args: any[]) => void
) {
	if (target.off) {
		target.off(type, listener);
	} else {
		target.removeListener?.(type, listener);
	}
}

function isPostMessageTarget(
	value: unknown
): value is EventTargetLike | EventEmitterLike {
	return (
		typeof value === 'object' &&
		value !== null &&
		'postMessage' in value &&
		typeof value.postMessage === 'function'
	);
}

function getEndpointType(target: object): string {
	const constructorName = target.constructor?.name;
	if (constructorName === 'MessagePort') {
		return 'message-port';
	}
	if (constructorName === 'Worker') {
		return 'addEventListener' in target ? 'browser-worker' : 'node-worker';
	}
	if (constructorName === 'DedicatedWorkerGlobalScope') {
		return 'browser-worker-global';
	}
	return constructorName
		? `post-message:${constructorName}`
		: 'post-message-endpoint';
}

function formatExitDetails(code: unknown, signal: unknown): string {
	const details = [];
	if (code !== null && code !== undefined) {
		details.push(`code ${String(code)}`);
	}
	if (signal !== null && signal !== undefined) {
		details.push(`signal ${String(signal)}`);
	}
	return details.length > 0 ? ` (${details.join(', ')})` : '';
}

interface RPCEnvelope {
	protocol: typeof RPC_PROTOCOL_MARKER;
	version: number;
	session: string;
	kind: string;
	requestId?: string;
	operation?: string;
	path?: string[];
	callbackId?: string;
	args?: RPCWireValue[];
	value?: RPCWireValue;
	error?: RPCWireThrown;
	remoteVersion?: number;
	message?: string;
}

type RPCWireThrown =
	| {
			kind: 'error';
			error: RPCWireError;
	  }
	| {
			kind: 'value';
			value: RPCWireValue;
	  };

interface RPCWireError {
	name: string;
	message: string;
	stack?: string;
	originalClassName: string;
	cause?: RPCWireThrown;
	properties: Record<string, RPCWireValue>;
}

type PendingOperation = {
	resolve(value: unknown): void;
	reject(error: unknown): void;
};

type SessionRole = 'client' | 'server';

interface RPCSessionOptions {
	role: SessionRole;
	root?: unknown;
	endpoint: RPCEndpointAdapter;
	codecs: readonly RPCValueCodec[];
	signal?: AbortSignal;
	transferPolicy?: RPCTransferPolicy;
	expectedSessionId?: string;
	handshakeRetryMs?: number;
}

class RPCSession implements RPCResourceOwner {
	readonly #role: SessionRole;
	readonly #root: unknown;
	readonly #endpoint: RPCEndpointAdapter;
	readonly #codecs: readonly RPCValueCodec[];
	readonly #codecsById: Map<string, RPCValueCodec>;
	readonly #transferPolicy: RPCTransferPolicy | undefined;
	readonly #pending = new Map<string, PendingOperation>();
	readonly #localCallbacks = new Map<string, (...args: any[]) => unknown>();
	readonly #callbackProxies = new Map<
		string,
		(...args: any[]) => Promise<unknown>
	>();
	readonly #terminalResources = new Set<
		(error: RemoteAPIEndpointTerminatedError) => void
	>();
	readonly #incomingRequestIds = new Set<string>();
	readonly #completedIncomingRequestIds = new Set<string>();
	readonly #completedIncomingRequestOrder: string[] = [];
	readonly #connectedPromise: Promise<void>;
	readonly #resolveConnected: () => void;
	readonly #rejectConnected: (error: unknown) => void;
	readonly #closedPromise: Promise<void>;
	readonly #resolveClosed: () => void;
	readonly #removeMessageListener: () => void;
	readonly #removeTerminationListeners: () => void;
	#removeAbortListener: () => void = () => {};
	#sessionId: string | undefined;
	#state: 'active' | 'terminal' = 'active';
	#handshakeComplete = false;
	#terminationError: RemoteAPIEndpointTerminatedError | undefined;
	#requestCounter = 0;
	#callbackCounter = 0;
	#handshakeTimer: ReturnType<typeof setInterval> | undefined;
	#releasePromise: Promise<void> | undefined;

	constructor(options: RPCSessionOptions) {
		this.#role = options.role;
		this.#root = options.root;
		this.#endpoint = options.endpoint;
		this.#codecs = options.codecs;
		this.#codecsById = new Map(
			options.codecs.map((codec) => [codec.id, codec])
		);
		this.#transferPolicy = options.transferPolicy;
		this.#sessionId =
			options.expectedSessionId ||
			(options.role === 'client' ? createSessionId() : undefined);

		let resolveConnected!: () => void;
		let rejectConnected!: (error: unknown) => void;
		this.#connectedPromise = new Promise<void>((resolve, reject) => {
			resolveConnected = resolve;
			rejectConnected = reject;
		});
		this.#resolveConnected = resolveConnected;
		this.#rejectConnected = rejectConnected;
		void this.#connectedPromise.catch(() => {});
		let resolveClosed!: () => void;
		this.#closedPromise = new Promise<void>((resolve) => {
			resolveClosed = resolve;
		});
		this.#resolveClosed = resolveClosed;

		this.#removeMessageListener = this.#endpoint.listen((message) =>
			this.#onMessage(message)
		);
		this.#removeTerminationListeners = this.#endpoint.listenForTermination(
			(reason, cause) => {
				this.terminate(
					new RemoteAPIEndpointTerminatedError(
						`The ${this.#endpoint.type} RPC endpoint terminated: ${reason}.`,
						{
							endpointType: this.#endpoint.type,
							reason,
							cause,
						}
					)
				);
			}
		);
		this.#removeAbortListener = listenForAbort(options.signal, (reason) => {
			this.terminate(
				new RemoteAPIEndpointTerminatedError(
					'The owner aborted the remote API endpoint.',
					{
						endpointType: this.#endpoint.type,
						reason: 'aborted',
						cause: reason,
					}
				),
				true
			);
		});
		this.#endpoint.start();

		if (this.#role === 'client' && this.#state === 'active') {
			const retryMs =
				options.handshakeRetryMs || DEFAULT_HANDSHAKE_RETRY_MS;
			this.#sendHello();
			this.#handshakeTimer = setInterval(
				() => this.#sendHello(),
				retryMs
			);
			unrefTimer(this.#handshakeTimer);
		}
	}

	get connected(): Promise<void> {
		return this.#connectedPromise;
	}

	get terminated(): boolean {
		return this.#state === 'terminal';
	}

	get closed(): Promise<void> {
		return this.#closedPromise;
	}

	get terminationError(): RemoteAPIEndpointTerminatedError | undefined {
		return this.#terminationError;
	}

	get endpointType(): string {
		return this.#endpoint.type;
	}

	get supportsTransfers(): boolean {
		return this.#endpoint.supportsTransfers;
	}

	addTerminalResource(
		terminate: (error: RemoteAPIEndpointTerminatedError) => void
	): () => void {
		if (this.#terminationError) {
			terminate(this.#terminationError);
			return () => {};
		}
		this.#terminalResources.add(terminate);
		return () => this.#terminalResources.delete(terminate);
	}

	trackPort(port: RPCClosablePort): void {
		this.addTerminalResource(() => {
			try {
				port.close?.();
			} catch {
				// Cleanup is deliberately idempotent.
			}
		});
	}

	get(path: RPCPath): Promise<unknown> {
		return this.#request({ operation: 'get', path });
	}

	call(path: RPCPath, args: readonly unknown[]): Promise<unknown> {
		return this.#request({ operation: 'call', path, args });
	}

	registerCallback(callback: (...args: any[]) => unknown): string {
		if (this.#terminationError) {
			throw this.#terminationError;
		}
		const id = `${this.#role === 'client' ? 'c' : 's'}-callback-${++this.#callbackCounter}`;
		this.#localCallbacks.set(id, callback);
		return id;
	}

	getCallbackProxy(callbackId: string): (...args: any[]) => Promise<unknown> {
		const existing = this.#callbackProxies.get(callbackId);
		if (existing) {
			return existing;
		}

		const proxy = (...args: any[]) =>
			this.#request({
				operation: 'callback',
				callbackId,
				args,
			});
		Object.defineProperty(proxy, releaseApiProxy, {
			configurable: false,
			enumerable: false,
			value: () => {
				this.#callbackProxies.delete(callbackId);
				if (!this.terminated && this.#sessionId) {
					this.#post({
						...this.#baseEnvelope('callback-release'),
						callbackId,
					});
				}
			},
		});
		this.#callbackProxies.set(callbackId, proxy);
		return proxy;
	}

	encode(value: unknown): EncodedRPCValue {
		for (const codec of this.#codecs) {
			if (codec.canEncode(value)) {
				const encoded = codec.encode(value, this.#codecContext());
				return {
					wire: {
						representation: 'codec',
						codec: codec.id,
						value: encoded.value,
					},
					transferables: encoded.transferables,
				};
			}
		}
		return {
			wire: { representation: 'clone', value },
			transferables: [],
		};
	}

	decode(wire: RPCWireValue): unknown {
		if (!isWireValue(wire)) {
			throw new RPCSerializationError('Received an invalid RPC value.');
		}
		if (wire.representation === 'clone') {
			return wire.value;
		}
		const codec = this.#codecsById.get(wire.codec);
		if (!codec) {
			throw new RPCSerializationError(
				`Received unknown RPC codec identifier "${wire.codec}".`
			);
		}
		return codec.decode(wire.value, this.#codecContext());
	}

	release(): Promise<void> {
		if (this.#releasePromise) {
			return this.#releasePromise;
		}
		this.#releasePromise = Promise.resolve();
		if (!this.#terminationError && this.#sessionId) {
			try {
				this.#post(this.#baseEnvelope('release'));
			} catch {
				// Local cleanup below is authoritative.
			}
		}
		this.terminate(
			new RemoteAPIEndpointTerminatedError(
				'The remote API proxy was released.',
				{
					endpointType: this.#endpoint.type,
					reason: 'released',
				}
			)
		);
		return this.#releasePromise;
	}

	terminate(
		error: RemoteAPIEndpointTerminatedError,
		notifyRemote = false
	): void {
		if (this.#state === 'terminal') {
			return;
		}
		if (notifyRemote && this.#sessionId) {
			try {
				this.#post({
					...this.#baseEnvelope('terminate'),
					message: error.message,
				});
			} catch {
				// Local cleanup remains authoritative when the peer is unreachable.
			}
		}
		this.#state = 'terminal';
		this.#terminationError = error;
		if (this.#handshakeTimer) {
			clearInterval(this.#handshakeTimer);
			this.#handshakeTimer = undefined;
		}
		this.#rejectConnected(error);

		const pending = [...this.#pending.values()];
		this.#pending.clear();
		for (const operation of pending) {
			operation.reject(error);
		}

		for (const terminateResource of this.#terminalResources) {
			try {
				terminateResource(error);
			} catch {
				// One resource must not prevent deterministic cleanup of others.
			}
		}
		this.#terminalResources.clear();
		this.#localCallbacks.clear();
		this.#callbackProxies.clear();
		this.#incomingRequestIds.clear();
		this.#removeAbortListener();
		this.#removeMessageListener();
		this.#removeTerminationListeners();
		this.#endpoint.close();
		this.#resolveClosed();
	}

	#codecContext(): RPCCodecContext {
		return {
			resources: this,
			encode: (value) => this.encode(value),
			decode: (value) => this.decode(value),
			registerCallback: (callback) => this.registerCallback(callback),
			getCallbackProxy: (callbackId) => this.getCallbackProxy(callbackId),
		};
	}

	#request({
		operation,
		path,
		callbackId,
		args = [],
	}: {
		operation: 'get' | 'call' | 'callback';
		path?: RPCPath;
		callbackId?: string;
		args?: readonly unknown[];
	}): Promise<unknown> {
		if (this.#terminationError) {
			return Promise.reject(this.#terminationError);
		}
		if (path) {
			assertSafePath(path);
		}

		const encodedArgs: RPCWireValue[] = [];
		const transferables: Transferable[] = [];
		try {
			for (const argument of args) {
				const encoded = this.encode(argument);
				encodedArgs.push(encoded.wire);
				transferables.push(...encoded.transferables);
			}
			if (operation === 'call' && path) {
				transferables.push(
					...getPolicyTransferables(
						this.#transferPolicy?.transferArguments,
						path,
						args
					)
				);
			}
		} catch (error) {
			return Promise.reject(asSerializationError(error));
		}

		const requestId = `${this.#role === 'client' ? 'c' : 's'}-${++this.#requestCounter}`;
		return new Promise((resolve, reject) => {
			this.#pending.set(requestId, { resolve, reject });
			void this.#connectedPromise.then(
				() => {
					if (!this.#pending.has(requestId)) {
						return;
					}
					try {
						this.#post(
							{
								...this.#baseEnvelope('request'),
								requestId,
								operation,
								path: path ? [...path] : undefined,
								callbackId,
								args: encodedArgs,
							},
							transferables
						);
					} catch (error) {
						if (error instanceof RemoteAPIEndpointTerminatedError) {
							this.terminate(error);
							return;
						}
						const pending = this.#pending.get(requestId);
						if (!pending) {
							return;
						}
						this.#pending.delete(requestId);
						pending.reject(asSerializationError(error));
					}
				},
				() => {
					// terminate() rejects every pending operation atomically.
				}
			);
		});
	}

	#sendHello(): void {
		if (this.#state === 'terminal' || this.#role !== 'client') {
			return;
		}
		try {
			this.#post(this.#baseEnvelope('hello'));
		} catch (cause) {
			this.terminate(
				new RemoteAPIEndpointTerminatedError(
					'Failed to contact the remote API endpoint.',
					{
						endpointType: this.#endpoint.type,
						reason: 'post-message-failed',
						cause,
					}
				)
			);
		}
	}

	#onMessage(message: unknown): void {
		if (this.#state === 'terminal' || !isEnvelopeCandidate(message)) {
			return;
		}
		if (message.protocol !== RPC_PROTOCOL_MARKER) {
			return;
		}

		if (message.kind === 'hello') {
			this.#onHello(message);
			return;
		}

		if (
			typeof message.session !== 'string' ||
			message.session !== this.#sessionId
		) {
			return;
		}

		if (message.version !== RPC_PROTOCOL_VERSION) {
			if (message.kind === 'protocol-error') {
				this.#onProtocolError(message);
			}
			return;
		}
		if (
			!this.#handshakeComplete &&
			message.kind !== 'hello-ack' &&
			message.kind !== 'protocol-error' &&
			message.kind !== 'release' &&
			message.kind !== 'terminate'
		) {
			return;
		}

		switch (message.kind) {
			case 'hello-ack':
				if (this.#role === 'client') {
					this.#finishHandshake();
				}
				break;
			case 'protocol-error':
				this.#onProtocolError(message);
				break;
			case 'request':
				void this.#onRequest(message);
				break;
			case 'response':
				this.#onResponse(message);
				break;
			case 'callback-release':
				if (typeof message.callbackId === 'string') {
					this.#localCallbacks.delete(message.callbackId);
				}
				break;
			case 'release':
			case 'terminate':
				this.terminate(
					new RemoteAPIEndpointTerminatedError(
						message.message ||
							'The remote side closed the API session.',
						{
							endpointType: this.#endpoint.type,
							reason: message.kind,
						}
					)
				);
				break;
			default:
				this.#respondToUnknownKind(message);
		}
	}

	#onHello(message: RPCEnvelope): void {
		if (
			this.#role !== 'server' ||
			typeof message.session !== 'string' ||
			message.session.length < 8 ||
			message.session.length > 200
		) {
			return;
		}
		if (message.version !== RPC_PROTOCOL_VERSION) {
			try {
				this.#endpoint.postMessage({
					protocol: RPC_PROTOCOL_MARKER,
					version: RPC_PROTOCOL_VERSION,
					session: message.session,
					kind: 'protocol-error',
					remoteVersion: RPC_PROTOCOL_VERSION,
					message:
						`Unsupported WordPress Playground RPC protocol version ` +
						`${message.version}; this endpoint supports version ` +
						`${RPC_PROTOCOL_VERSION}.`,
				});
			} catch {
				// A version mismatch is already terminal for this peer.
			}
			return;
		}
		if (this.#sessionId && message.session !== this.#sessionId) {
			return;
		}
		this.#sessionId = message.session;
		this.#post(this.#baseEnvelope('hello-ack'));
		this.#finishHandshake();
	}

	#finishHandshake(): void {
		this.#handshakeComplete = true;
		if (this.#handshakeTimer) {
			clearInterval(this.#handshakeTimer);
			this.#handshakeTimer = undefined;
		}
		this.#resolveConnected();
	}

	#onProtocolError(message: RPCEnvelope): void {
		if (!isProtocolErrorEnvelope(message)) return;
		this.terminate(
			new RPCProtocolVersionMismatchError(
				message.remoteVersion,
				this.#endpoint.type
			)
		);
	}

	async #onRequest(message: RPCEnvelope): Promise<void> {
		if (
			typeof message.requestId !== 'string' ||
			this.#incomingRequestIds.has(message.requestId) ||
			this.#completedIncomingRequestIds.has(message.requestId)
		) {
			return;
		}
		this.#incomingRequestIds.add(message.requestId);

		try {
			let result: unknown;
			try {
				result = await this.#dispatchRequest(message);
			} catch (error) {
				this.#sendErrorResponse(message.requestId, error);
				return;
			}

			try {
				const encoded = this.encode(result);
				const path = isSafePath(message.path) ? message.path : [];
				const policyTransferables =
					message.operation === 'get' || message.operation === 'call'
						? getPolicyTransferables(
								this.#transferPolicy?.transferResult,
								path,
								result
							)
						: [];
				this.#post(
					{
						...this.#baseEnvelope('response'),
						requestId: message.requestId,
						value: encoded.wire,
					},
					[...encoded.transferables, ...policyTransferables]
				);
			} catch (serializationFailure) {
				this.#sendErrorResponse(
					message.requestId,
					new RPCSerializationError(
						'The remote result could not be serialized.',
						{ cause: serializationFailure }
					)
				);
			}
		} finally {
			this.#incomingRequestIds.delete(message.requestId);
			this.#rememberCompletedRequest(message.requestId);
		}
	}

	#sendErrorResponse(requestId: string, error: unknown): void {
		let encoded: {
			wire: RPCWireThrown;
			transferables: Transferable[];
		};
		try {
			encoded = this.#encodeThrown(error);
		} catch (serializationFailure) {
			encoded = this.#encodeThrown(
				new RPCSerializationError(
					'The remote error could not be serialized.',
					{ cause: serializationFailure }
				)
			);
		}
		try {
			this.#post(
				{
					...this.#baseEnvelope('response'),
					requestId,
					error: encoded.wire,
				},
				encoded.transferables
			);
		} catch (cause) {
			this.terminate(
				new RemoteAPIEndpointTerminatedError(
					'Failed to post an RPC error response.',
					{
						endpointType: this.#endpoint.type,
						reason: 'response-post-failed',
						cause,
					}
				)
			);
		}
	}

	async #dispatchRequest(message: RPCEnvelope): Promise<unknown> {
		if (!Array.isArray(message.args) || !message.args.every(isWireValue)) {
			throw new RPCSerializationError(
				'RPC request arguments are invalid.'
			);
		}
		const args = message.args.map((argument) => this.decode(argument));

		if (message.operation === 'callback') {
			if (typeof message.callbackId !== 'string') {
				throw new RPCSerializationError(
					'Callback request is missing its callback identifier.'
				);
			}
			const callback = this.#localCallbacks.get(message.callbackId);
			if (!callback) {
				throw new Error(
					`Remote callback "${message.callbackId}" is no longer available.`
				);
			}
			return await callback(...args);
		}

		if (this.#role !== 'server') {
			throw new Error('This RPC session does not expose a root API.');
		}
		if (!isSafePath(message.path)) {
			throw new RPCSerializationError('RPC request path is invalid.');
		}
		if (message.operation === 'get') {
			return await resolveRemoteProperty(this.#root, message.path);
		}
		if (message.operation === 'call') {
			const { owner, value } = await resolveRemoteCallable(
				this.#root,
				message.path
			);
			if (typeof value !== 'function') {
				throw new TypeError(
					`Remote path "${message.path.join('.')}" is not callable.`
				);
			}
			return await Reflect.apply(value, owner, args);
		}
		throw new RPCSerializationError(
			`Unknown RPC request operation "${String(message.operation)}".`
		);
	}

	#onResponse(message: RPCEnvelope): void {
		if (typeof message.requestId !== 'string') {
			return;
		}
		const pending = this.#pending.get(message.requestId);
		if (!pending) {
			return;
		}
		this.#pending.delete(message.requestId);
		try {
			const hasError = Object.prototype.hasOwnProperty.call(
				message,
				'error'
			);
			const hasValue = Object.prototype.hasOwnProperty.call(
				message,
				'value'
			);
			if (hasError === hasValue) {
				throw new RPCSerializationError(
					'RPC response must contain exactly one value or error.'
				);
			}
			if (hasError) {
				pending.reject(
					this.#decodeThrown(message.error as RPCWireThrown)
				);
				return;
			}
			if (!isWireValue(message.value)) {
				throw new RPCSerializationError(
					'RPC response contains neither a value nor an error.'
				);
			}
			pending.resolve(this.decode(message.value));
		} catch (error) {
			pending.reject(error);
		}
	}

	#respondToUnknownKind(message: RPCEnvelope): void {
		if (typeof message.requestId !== 'string') {
			return;
		}
		const encoded = this.#encodeThrown(
			new RPCSerializationError(
				`Unknown RPC message kind "${String(message.kind)}".`
			)
		);
		try {
			this.#post(
				{
					...this.#baseEnvelope('response'),
					requestId: message.requestId,
					error: encoded.wire,
				},
				encoded.transferables
			);
		} catch {
			// Hostile messages must not destabilize an otherwise usable session.
		}
	}

	#encodeThrown(value: unknown): {
		wire: RPCWireThrown;
		transferables: Transferable[];
	} {
		return encodeThrown(value, (nested) => this.encode(nested));
	}

	#decodeThrown(value: RPCWireThrown): unknown {
		return decodeThrown(value, (nested) => this.decode(nested));
	}

	#rememberCompletedRequest(requestId: string): void {
		this.#completedIncomingRequestIds.add(requestId);
		this.#completedIncomingRequestOrder.push(requestId);
		if (this.#completedIncomingRequestOrder.length > 1024) {
			const oldest = this.#completedIncomingRequestOrder.shift();
			if (oldest) {
				this.#completedIncomingRequestIds.delete(oldest);
			}
		}
	}

	#baseEnvelope(kind: string): RPCEnvelope {
		if (!this.#sessionId) {
			throw new Error('RPC session has not been established.');
		}
		return {
			protocol: RPC_PROTOCOL_MARKER,
			version: RPC_PROTOCOL_VERSION,
			session: this.#sessionId,
			kind,
		};
	}

	#post(
		envelope: RPCEnvelope,
		transferables: readonly Transferable[] = []
	): void {
		const uniqueTransferables = deduplicateTransferables(transferables);
		if (
			!this.#endpoint.supportsTransfers &&
			uniqueTransferables.length > 0
		) {
			throw new RPCUnsupportedTransferError(this.#endpoint.type);
		}
		this.#endpoint.postMessage(envelope, uniqueTransferables);
	}
}

type RemoteCallback<T> = T extends (...args: infer Args) => infer Result
	? ((...args: Args) => Promise<RemoteReturned<Awaited<Result>>>) & {
			[releaseApiProxy]: () => void | Promise<void>;
		}
	: never;

type RemoteReturned<T> = T extends (...args: any[]) => any
	? RemoteCallback<T>
	: T;

export type RemoteMethod<T> = T extends (...args: infer Args) => infer Result
	? (...args: Args) => Promise<RemoteReturned<Awaited<Result>>>
	: never;

type RemoteProperty<T> = T extends (...args: any[]) => any
	? RemoteMethod<T>
	: T extends object
		? Remote<T> & Promise<Awaited<T>>
		: Promise<Awaited<T>>;

export type Remote<T> = T extends {
	[releaseApiProxy]: (...args: any[]) => unknown;
}
	? T
	: T extends (...args: any[]) => any
		? RemoteCallback<T>
		: {
				[P in keyof T]: RemoteProperty<T[P]>;
			} & {
				[releaseApiProxy]: () => Promise<void>;
			};

export function createRPCClient<T>(
	endpoint: RPCEndpointAdapter,
	codecs: readonly RPCValueCodec[],
	options: RPCClientOptions = {}
): Remote<T> {
	const session = new RPCSession({
		role: 'client',
		endpoint,
		codecs,
		signal: options.signal,
		transferPolicy: options.transferPolicy,
		handshakeRetryMs: options.handshakeRetryMs,
	});
	return createRemoteProxy(session, []) as Remote<T>;
}

export function exposeRPC(
	root: unknown,
	endpoint: RPCEndpointAdapter,
	codecs: readonly RPCValueCodec[],
	options: RPCServerOptions = {}
): {
	connected: Promise<void>;
	closed: Promise<void>;
	terminate(error?: Error): void;
} {
	const session = new RPCSession({
		role: 'server',
		root,
		endpoint,
		codecs,
		signal: options.signal,
		transferPolicy: options.transferPolicy,
		expectedSessionId: options.expectedSessionId,
	});
	return {
		connected: session.connected,
		closed: session.closed,
		terminate(error) {
			session.terminate(
				new RemoteAPIEndpointTerminatedError(
					error?.message || 'The exposed RPC session was terminated.',
					{
						endpointType: endpoint.type,
						reason: 'server-terminated',
						cause: error,
					}
				),
				true
			);
		},
	};
}

function createRemoteProxy(session: RPCSession, path: readonly string[]): any {
	const target = function remoteProxyTarget() {};
	const proxy = new Proxy(target, {
		get(_target, property) {
			if (property === releaseApiProxy) {
				return path.length === 0 ? () => session.release() : undefined;
			}
			if (property === 'isConnected' && path.length === 0) {
				return () => session.connected;
			}
			if (property === 'then') {
				if (path.length === 0) {
					return undefined;
				}
				return (
					resolve: (value: unknown) => void,
					reject: (error: unknown) => void
				) => session.get(path).then(resolve, reject);
			}
			if (property === 'bind') {
				return undefined;
			}
			if (property === Symbol.toStringTag) {
				return 'RemoteAPI';
			}
			if (property === Symbol.for('nodejs.util.inspect.custom')) {
				return () => `[RemoteAPI ${path.join('.') || '<root>'}]`;
			}
			if (typeof property === 'symbol') {
				return undefined;
			}
			return createRemoteProxy(session, [...path, property]);
		},
		apply(_target, _thisArgument, args) {
			return session.call(path, args);
		},
		set() {
			throw new RPCUnsupportedOperationError('property assignment');
		},
		construct() {
			throw new RPCUnsupportedOperationError('construction');
		},
	});
	remoteProxies.add(proxy);
	return proxy;
}

async function resolveRemoteProperty(
	root: unknown,
	path: readonly string[]
): Promise<unknown> {
	let value = root;
	for (const [index, component] of path.entries()) {
		assertSafePathComponent(component);
		if (value === null || value === undefined) {
			return undefined;
		}
		const next = Reflect.get(Object(value), component);
		value =
			index < path.length - 1 && isRPCRemoteProxy(next)
				? next
				: await next;
	}
	return value;
}

async function resolveRemoteCallable(
	root: unknown,
	path: readonly string[]
): Promise<{ owner: unknown; value: unknown }> {
	if (path.length === 0) {
		return { owner: undefined, value: root };
	}
	let owner = root;
	for (const component of path.slice(0, -1)) {
		assertSafePathComponent(component);
		if (owner === null || owner === undefined) {
			return { owner, value: undefined };
		}
		const next = Reflect.get(Object(owner), component);
		owner = isRPCRemoteProxy(next) ? next : await next;
	}
	const finalComponent = path[path.length - 1];
	assertSafePathComponent(finalComponent);
	if (owner === null || owner === undefined) {
		return { owner, value: undefined };
	}
	return {
		owner,
		value: Reflect.get(Object(owner), finalComponent),
	};
}

function encodeThrown(
	value: unknown,
	encodeValue: (value: unknown) => EncodedRPCValue,
	seen: Set<unknown> = new Set()
): { wire: RPCWireThrown; transferables: Transferable[] } {
	if (!(value instanceof Error)) {
		const encoded = encodeValue(value);
		return {
			wire: { kind: 'value', value: encoded.wire },
			transferables: encoded.transferables,
		};
	}

	if (seen.has(value)) {
		const encoded = encodeValue('[Circular error cause]');
		return {
			wire: { kind: 'value', value: encoded.wire },
			transferables: encoded.transferables,
		};
	}
	seen.add(value);

	const transferables: Transferable[] = [];
	let cause: RPCWireThrown | undefined;
	if ('cause' in value && value.cause !== undefined) {
		const encodedCause = encodeThrown(value.cause, encodeValue, seen);
		cause = encodedCause.wire;
		transferables.push(...encodedCause.transferables);
	}

	const properties: Record<string, RPCWireValue> = Object.create(null);
	for (const property of Object.getOwnPropertyNames(value)) {
		if (
			property === 'name' ||
			property === 'message' ||
			property === 'stack' ||
			property === 'cause' ||
			FORBIDDEN_PATH_COMPONENTS.has(property)
		) {
			continue;
		}
		const descriptor = Object.getOwnPropertyDescriptor(value, property);
		if (!descriptor || !('value' in descriptor)) {
			continue;
		}
		const encoded = encodeValue(descriptor.value);
		properties[property] = encoded.wire;
		transferables.push(...encoded.transferables);
	}

	return {
		wire: {
			kind: 'error',
			error: {
				name: typeof value.name === 'string' ? value.name : 'Error',
				message:
					typeof value.message === 'string'
						? value.message
						: String(value.message),
				stack:
					typeof value.stack === 'string' ? value.stack : undefined,
				originalClassName:
					typeof value.constructor?.name === 'string'
						? value.constructor.name
						: 'Error',
				cause,
				properties,
			},
		},
		transferables,
	};
}

function decodeThrown(
	value: RPCWireThrown,
	decodeValue: (value: RPCWireValue) => unknown
): unknown {
	if (
		!isRecord(value) ||
		(value.kind !== 'error' && value.kind !== 'value')
	) {
		return new RPCSerializationError('Received an invalid remote error.');
	}
	if (value.kind === 'value') {
		return isWireValue(value.value)
			? decodeValue(value.value)
			: new RPCSerializationError('Received an invalid thrown value.');
	}
	if (!isWireError(value.error)) {
		return new RPCSerializationError('Received invalid remote Error data.');
	}

	const error = createDeserializedError(value.error);
	if (value.error.stack !== undefined) {
		error.stack = value.error.stack;
	}
	if (value.error.cause !== undefined) {
		error.cause = decodeThrown(value.error.cause, decodeValue);
	}
	Object.defineProperty(error, 'originalErrorClassName', {
		configurable: true,
		enumerable: true,
		writable: true,
		value: value.error.originalClassName,
	});
	for (const [property, encoded] of Object.entries(value.error.properties)) {
		if (FORBIDDEN_PATH_COMPONENTS.has(property) || !isWireValue(encoded)) {
			continue;
		}
		Object.defineProperty(error, property, {
			configurable: true,
			enumerable: true,
			writable: true,
			value: decodeValue(encoded),
		});
	}
	return error;
}

function createDeserializedError(value: RPCWireError): Error {
	let error: Error;
	switch (value.originalClassName) {
		case 'RPCSerializationError':
			error = new RPCSerializationError(value.message);
			break;
		case 'TypeError':
			error = new TypeError(value.message);
			break;
		case 'RangeError':
			error = new RangeError(value.message);
			break;
		case 'ReferenceError':
			error = new ReferenceError(value.message);
			break;
		case 'SyntaxError':
			error = new SyntaxError(value.message);
			break;
		case 'URIError':
			error = new URIError(value.message);
			break;
		case 'EvalError':
			error = new EvalError(value.message);
			break;
		default:
			error = new Error(value.message);
	}
	error.name = value.name;
	return error;
}

function isWireError(value: unknown): value is RPCWireError {
	return (
		isRecord(value) &&
		typeof value['name'] === 'string' &&
		typeof value['message'] === 'string' &&
		(value['stack'] === undefined || typeof value['stack'] === 'string') &&
		typeof value['originalClassName'] === 'string' &&
		isRecord(value['properties'])
	);
}

function isWireValue(value: unknown): value is RPCWireValue {
	return (
		isRecord(value) &&
		(value['representation'] === 'clone' ||
			(value['representation'] === 'codec' &&
				typeof value['codec'] === 'string')) &&
		'value' in value
	);
}

function isEnvelopeCandidate(value: unknown): value is RPCEnvelope {
	return (
		isRecord(value) &&
		typeof value['protocol'] === 'string' &&
		isProtocolVersion(value['version']) &&
		typeof value['session'] === 'string' &&
		typeof value['kind'] === 'string'
	);
}

function isProtocolErrorEnvelope(
	value: unknown
): value is RPCEnvelope & { remoteVersion: number } {
	return (
		isRecord(value) &&
		isProtocolVersion(value['remoteVersion']) &&
		(value['message'] === undefined || typeof value['message'] === 'string')
	);
}

function isProtocolVersion(value: unknown): value is number {
	return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isRecord(value: unknown): value is Record<string, any> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafePath(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.length <= 64 &&
		value.every(
			(component) =>
				typeof component === 'string' &&
				component.length <= 1024 &&
				!FORBIDDEN_PATH_COMPONENTS.has(component)
		)
	);
}

function assertSafePath(path: RPCPath): void {
	if (!isSafePath(path)) {
		throw new RPCSerializationError('RPC path is invalid or unsafe.');
	}
}

function assertSafePathComponent(component: string): void {
	if (FORBIDDEN_PATH_COMPONENTS.has(component)) {
		throw new RPCSerializationError(
			`RPC path component "${component}" is not allowed.`
		);
	}
}

function getPolicyTransferables<Args extends readonly unknown[]>(
	hook:
		| ((path: RPCPath, ...args: Args) => readonly Transferable[])
		| undefined,
	path: RPCPath,
	...args: Args
): Transferable[] {
	if (!hook) {
		return [];
	}
	const result = hook(path, ...args);
	if (!Array.isArray(result)) {
		throw new RPCSerializationError(
			'RPC transfer-policy hooks must return an array.'
		);
	}
	return [...result];
}

function deduplicateTransferables(
	transferables: readonly Transferable[]
): Transferable[] {
	return [...new Set(transferables)];
}

function asSerializationError(error: unknown): Error {
	if (
		error instanceof RPCSerializationError ||
		error instanceof RemoteAPIEndpointTerminatedError
	) {
		return error;
	}
	return new RPCSerializationError('RPC message serialization failed.', {
		cause: error,
	});
}

function createSessionId(): string {
	const cryptoObject = globalThis.crypto;
	if (typeof cryptoObject?.randomUUID === 'function') {
		return cryptoObject.randomUUID();
	}
	if (typeof cryptoObject?.getRandomValues === 'function') {
		const bytes = cryptoObject.getRandomValues(new Uint8Array(16));
		return [...bytes]
			.map((value) => value.toString(16).padStart(2, '0'))
			.join('');
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
		.toString(36)
		.slice(2)}`;
}

function listenForAbort(
	signal: AbortSignal | undefined,
	onAbort: (reason: unknown) => void
): () => void {
	if (!signal) {
		return () => {};
	}
	if (signal.aborted) {
		onAbort(signal.reason);
		return () => {};
	}
	const listener = () => onAbort(signal.reason);
	signal.addEventListener('abort', listener, { once: true });
	return () => signal.removeEventListener('abort', listener);
}

function unrefTimer(timer: ReturnType<typeof setInterval>): void {
	if (
		typeof timer === 'object' &&
		timer !== null &&
		'unref' in timer &&
		typeof timer.unref === 'function'
	) {
		timer.unref();
	}
}

const endpointModes = new WeakMap<object, string>();

export function reserveRPCEndpoint(target: unknown, mode: string): void {
	if (
		(typeof target !== 'object' || target === null) &&
		typeof target !== 'function'
	) {
		return;
	}
	const objectTarget = target as object;
	const existingMode = endpointModes.get(objectTarget);
	if (existingMode) {
		throw new Error(
			`RPC endpoint is already reserved for ${existingMode}; ` +
				`${mode} requires a dedicated endpoint.`
		);
	}
	endpointModes.set(objectTarget, mode);
}

interface SyncRPCEnvelope {
	protocol: typeof RPC_PROTOCOL_MARKER;
	version: number;
	session: string;
	kind: string;
	requestId?: string;
	path?: string[];
	payload?: string;
	sharedBuffer?: SharedArrayBuffer;
	remoteVersion?: number;
}

const SYNC_STATUS_WAITING = 0;
const SYNC_STATUS_SUCCESS = 1;
const SYNC_STATUS_REMOTE_ERROR = 2;
const SYNC_STATUS_RESPONSE_TOO_LARGE = 3;
const SYNC_STATUS_ENDPOINT_TERMINATED = 4;

class SyncRPCClientSession {
	readonly #endpoint: RPCEndpointAdapter;
	readonly #sessionId = createSessionId();
	readonly #timeoutMs: number;
	readonly #maxResponseBytes: number;
	readonly #removeMessageListener: () => void;
	readonly #removeTerminationListener: () => void;
	#removeAbortListener: () => void = () => {};
	#terminalError: RemoteAPIEndpointTerminatedError | undefined;
	#rejectHandshake: ((error: unknown) => void) | undefined;
	#requestCounter = 0;

	constructor(endpoint: RPCEndpointAdapter, options: SyncRPCClientOptions) {
		this.#endpoint = endpoint;
		this.#timeoutMs = requirePositiveFiniteNumber(
			options.timeoutMs ?? DEFAULT_SYNC_TIMEOUT_MS,
			'timeoutMs'
		);
		this.#maxResponseBytes = requirePositiveInteger(
			options.maxResponseBytes ?? DEFAULT_SYNC_RESPONSE_BYTES,
			'maxResponseBytes'
		);
		this.#removeMessageListener = endpoint.listen(() => {});
		this.#removeTerminationListener = endpoint.listenForTermination(
			(reason, cause) => {
				this.terminate(
					new RemoteAPIEndpointTerminatedError(
						`The synchronous RPC endpoint terminated: ${reason}.`,
						{
							endpointType: endpoint.type,
							reason,
							cause,
						}
					)
				);
			}
		);
		this.#removeAbortListener = listenForAbort(options.signal, (reason) => {
			this.terminate(
				new RemoteAPIEndpointTerminatedError(
					'The owner aborted the synchronous RPC endpoint.',
					{
						endpointType: endpoint.type,
						reason: 'aborted',
						cause: reason,
					}
				)
			);
		});
		endpoint.start();
	}

	async connect(handshakeTimeoutMs: number): Promise<void> {
		if (this.#terminalError) {
			throw this.#terminalError;
		}
		let removeListener = () => {};
		let retryTimer: ReturnType<typeof setInterval> | undefined;
		let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
		try {
			await new Promise<void>((resolve, reject) => {
				this.#rejectHandshake = reject;
				removeListener = this.#endpoint.listen((message) => {
					if (
						!isSyncEnvelope(message) ||
						message.session !== this.#sessionId
					) {
						return;
					}
					if (message.kind === 'protocol-error') {
						if (!isProtocolErrorEnvelope(message)) return;
						reject(
							new RPCProtocolVersionMismatchError(
								message.remoteVersion,
								this.#endpoint.type
							)
						);
						return;
					}
					if (
						message.version === RPC_PROTOCOL_VERSION &&
						message.kind === 'sync-hello-ack'
					) {
						resolve();
					}
				});
				const sendHello = () => {
					try {
						this.#endpoint.postMessage(
							this.#envelope('sync-hello')
						);
					} catch (error) {
						reject(error);
					}
				};
				sendHello();
				retryTimer = setInterval(sendHello, DEFAULT_HANDSHAKE_RETRY_MS);
				unrefTimer(retryTimer);
				timeoutTimer = setTimeout(
					() =>
						reject(
							new SyncRPCOperationTimeoutError(handshakeTimeoutMs)
						),
					handshakeTimeoutMs
				);
				unrefTimeout(timeoutTimer);
			});
		} catch (error) {
			if (error instanceof RemoteAPIEndpointTerminatedError) {
				this.terminate(error);
			} else {
				this.terminate(
					new RemoteAPIEndpointTerminatedError(
						'The synchronous RPC handshake did not complete.',
						{
							endpointType: this.#endpoint.type,
							reason: 'handshake-failed',
							cause: error,
						}
					)
				);
			}
			throw error;
		} finally {
			this.#rejectHandshake = undefined;
			removeListener();
			if (retryTimer) {
				clearInterval(retryTimer);
			}
			if (timeoutTimer) {
				clearTimeout(timeoutTimer);
			}
		}
	}

	call(path: readonly string[], args: readonly unknown[]): unknown {
		if (this.#terminalError) {
			throw this.#terminalError;
		}
		assertSafePath(path);

		let payload: string;
		try {
			payload = encodeSyncData(args);
		} catch (cause) {
			throw new RPCSerializationError(
				'Synchronous RPC arguments could not be serialized.',
				{ cause }
			);
		}

		const sharedBuffer = new SharedArrayBuffer(8 + this.#maxResponseBytes);
		const status = new Int32Array(sharedBuffer, 0, 2);
		const requestId = `sync-${++this.#requestCounter}`;
		try {
			this.#endpoint.postMessage({
				...this.#envelope('sync-request'),
				requestId,
				path: [...path],
				payload,
				sharedBuffer,
			});
		} catch (cause) {
			const error = new RemoteAPIEndpointTerminatedError(
				'Failed to post a synchronous RPC request.',
				{
					endpointType: this.#endpoint.type,
					reason: 'post-message-failed',
					cause,
				}
			);
			this.terminate(error);
			throw error;
		}

		const waitResult = Atomics.wait(
			status,
			0,
			SYNC_STATUS_WAITING,
			this.#timeoutMs
		);
		if (waitResult === 'timed-out') {
			throw new SyncRPCOperationTimeoutError(this.#timeoutMs);
		}

		const responseStatus = Atomics.load(status, 0);
		if (responseStatus === SYNC_STATUS_ENDPOINT_TERMINATED) {
			throw new RemoteAPIEndpointTerminatedError(
				'The synchronous RPC endpoint was lost during the call.',
				{
					endpointType: this.#endpoint.type,
					reason: 'endpoint-lost',
				}
			);
		}
		if (responseStatus === SYNC_STATUS_RESPONSE_TOO_LARGE) {
			throw new RPCSerializationError(
				`Synchronous RPC response exceeded ${this.#maxResponseBytes} bytes.`
			);
		}
		if (
			responseStatus !== SYNC_STATUS_SUCCESS &&
			responseStatus !== SYNC_STATUS_REMOTE_ERROR
		) {
			throw new RPCSerializationError(
				`Synchronous RPC returned invalid status ${responseStatus}.`
			);
		}

		const length = Atomics.load(status, 1);
		if (length < 0 || length > this.#maxResponseBytes) {
			throw new RPCSerializationError(
				'Synchronous RPC returned an invalid payload length.'
			);
		}
		const bytes = new Uint8Array(sharedBuffer, 8, length);
		let response: unknown;
		try {
			response = decodeSyncData(new TextDecoder().decode(bytes));
		} catch (cause) {
			throw new RPCSerializationError(
				'Synchronous RPC response could not be decoded.',
				{ cause }
			);
		}
		if (responseStatus === SYNC_STATUS_REMOTE_ERROR) {
			throw decodeSyncThrown(response);
		}
		return response;
	}

	release(): Promise<void> {
		if (!this.#terminalError) {
			try {
				this.#endpoint.postMessage(this.#envelope('release'));
			} catch {
				// Local cleanup is authoritative.
			}
			this.terminate(
				new RemoteAPIEndpointTerminatedError(
					'The synchronous remote API proxy was released.',
					{
						endpointType: this.#endpoint.type,
						reason: 'released',
					}
				)
			);
		}
		return Promise.resolve();
	}

	terminate(error: RemoteAPIEndpointTerminatedError): void {
		if (this.#terminalError) {
			return;
		}
		this.#terminalError = error;
		this.#rejectHandshake?.(error);
		this.#rejectHandshake = undefined;
		this.#removeAbortListener();
		this.#removeMessageListener();
		this.#removeTerminationListener();
		this.#endpoint.close();
	}

	#envelope(kind: string): SyncRPCEnvelope {
		return {
			protocol: RPC_PROTOCOL_MARKER,
			version: RPC_PROTOCOL_VERSION,
			session: this.#sessionId,
			kind,
		};
	}
}

class SyncRPCServerSession {
	readonly #root: unknown;
	readonly #endpoint: RPCEndpointAdapter;
	readonly #removeMessageListener: () => void;
	readonly #removeTerminationListener: () => void;
	readonly #inFlightBuffers = new Set<SharedArrayBuffer>();
	#removeAbortListener: () => void = () => {};
	#sessionId: string | undefined;
	#terminal = false;

	constructor(
		root: unknown,
		endpoint: RPCEndpointAdapter,
		options: SyncRPCServerOptions
	) {
		this.#root = root;
		this.#endpoint = endpoint;
		this.#removeMessageListener = endpoint.listen((message) =>
			this.#onMessage(message)
		);
		this.#removeTerminationListener = endpoint.listenForTermination(() =>
			this.terminate()
		);
		this.#removeAbortListener = listenForAbort(options.signal, () =>
			this.terminate()
		);
		endpoint.start();
	}

	terminate(): void {
		if (this.#terminal) {
			return;
		}
		this.#terminal = true;
		for (const sharedBuffer of this.#inFlightBuffers) {
			writeSyncStatus(sharedBuffer, SYNC_STATUS_ENDPOINT_TERMINATED);
		}
		this.#inFlightBuffers.clear();
		this.#removeAbortListener();
		this.#removeMessageListener();
		this.#removeTerminationListener();
		this.#endpoint.close();
	}

	#onMessage(message: unknown): void {
		if (this.#terminal || !isSyncEnvelope(message)) {
			return;
		}
		if (message.kind === 'sync-hello') {
			this.#onHello(message);
			return;
		}
		if (
			message.version !== RPC_PROTOCOL_VERSION ||
			message.session !== this.#sessionId
		) {
			return;
		}
		if (message.kind === 'release') {
			this.terminate();
			return;
		}
		if (message.kind === 'sync-request') {
			void this.#onRequest(message);
		}
	}

	#onHello(message: SyncRPCEnvelope): void {
		if (message.version !== RPC_PROTOCOL_VERSION) {
			this.#endpoint.postMessage({
				protocol: RPC_PROTOCOL_MARKER,
				version: RPC_PROTOCOL_VERSION,
				session: message.session,
				kind: 'protocol-error',
				remoteVersion: RPC_PROTOCOL_VERSION,
			});
			return;
		}
		if (this.#sessionId && message.session !== this.#sessionId) {
			return;
		}
		this.#sessionId = message.session;
		this.#endpoint.postMessage({
			protocol: RPC_PROTOCOL_MARKER,
			version: RPC_PROTOCOL_VERSION,
			session: this.#sessionId,
			kind: 'sync-hello-ack',
		});
	}

	async #onRequest(message: SyncRPCEnvelope): Promise<void> {
		if (
			!(message.sharedBuffer instanceof SharedArrayBuffer) ||
			message.sharedBuffer.byteLength < 8 ||
			typeof message.requestId !== 'string' ||
			message.requestId.length === 0 ||
			message.requestId.length > 200 ||
			!isSafePath(message.path) ||
			typeof message.payload !== 'string'
		) {
			return;
		}
		const sharedBuffer = message.sharedBuffer;
		this.#inFlightBuffers.add(sharedBuffer);
		try {
			const args = decodeSyncData(message.payload);
			if (!Array.isArray(args)) {
				throw new RPCSerializationError(
					'Synchronous RPC arguments must be an array.'
				);
			}
			const { owner, value } = await resolveRemoteCallable(
				this.#root,
				message.path
			);
			if (typeof value !== 'function') {
				throw new TypeError(
					`Remote path "${message.path.join('.')}" is not callable.`
				);
			}
			const result = await Reflect.apply(value, owner, args);
			if (this.#terminal) {
				writeSyncStatus(sharedBuffer, SYNC_STATUS_ENDPOINT_TERMINATED);
				return;
			}
			writeSyncPayload(
				sharedBuffer,
				SYNC_STATUS_SUCCESS,
				encodeSyncData(result)
			);
		} catch (error) {
			if (this.#terminal) {
				writeSyncStatus(sharedBuffer, SYNC_STATUS_ENDPOINT_TERMINATED);
				return;
			}
			try {
				writeSyncPayload(
					sharedBuffer,
					SYNC_STATUS_REMOTE_ERROR,
					encodeSyncData(encodeSyncThrown(error))
				);
			} catch {
				writeSyncStatus(sharedBuffer, SYNC_STATUS_RESPONSE_TOO_LARGE);
			}
		} finally {
			this.#inFlightBuffers.delete(sharedBuffer);
		}
	}
}

export async function createSyncRPCClient<T>(
	target: unknown,
	options: SyncRPCClientOptions = {}
): Promise<T> {
	assertDedicatedSyncMessagePort(target);
	const timeoutMs = requirePositiveFiniteNumber(
		options.timeoutMs ?? DEFAULT_SYNC_TIMEOUT_MS,
		'timeoutMs'
	);
	const handshakeTimeoutMs = requirePositiveFiniteNumber(
		options.handshakeTimeoutMs ?? timeoutMs,
		'handshakeTimeoutMs'
	);
	const maxResponseBytes = requirePositiveInteger(
		options.maxResponseBytes ?? DEFAULT_SYNC_RESPONSE_BYTES,
		'maxResponseBytes'
	);
	reserveRPCEndpoint(target, 'synchronous RPC consumption');
	const endpoint = createRPCEndpointAdapter(target, { ownsTarget: true });
	const session = new SyncRPCClientSession(endpoint, {
		...options,
		timeoutMs,
		maxResponseBytes,
	});
	await session.connect(handshakeTimeoutMs);
	return createSyncRemoteProxy(session, []) as T;
}

export function exposeSyncRPC(
	root: unknown,
	target: unknown,
	options: SyncRPCServerOptions = {}
): { terminate(): void } {
	assertDedicatedSyncMessagePort(target);
	reserveRPCEndpoint(target, 'synchronous RPC exposure');
	const endpoint = createRPCEndpointAdapter(target, { ownsTarget: true });
	const session = new SyncRPCServerSession(root, endpoint, options);
	return { terminate: () => session.terminate() };
}

function assertDedicatedSyncMessagePort(target: unknown): void {
	if (
		((typeof target !== 'object' || target === null) &&
			typeof target !== 'function') ||
		isNodeProcess(target) ||
		getEndpointType(target as object) !== 'message-port'
	) {
		throw new TypeError(
			'Synchronous RPC requires a dedicated MessagePort endpoint.'
		);
	}
	const candidate = target as {
		postMessage?: unknown;
		start?: unknown;
		close?: unknown;
		terminate?: unknown;
	};
	if (
		typeof candidate.postMessage !== 'function' ||
		typeof candidate.start !== 'function' ||
		typeof candidate.close !== 'function' ||
		typeof candidate.terminate === 'function'
	) {
		throw new TypeError(
			'Synchronous RPC requires a dedicated MessagePort endpoint.'
		);
	}
}

function requirePositiveFiniteNumber(value: number, option: string): number {
	if (!Number.isFinite(value) || value <= 0) {
		throw new RangeError(`${option} must be a positive finite number.`);
	}
	return value;
}

function requirePositiveInteger(value: number, option: string): number {
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new RangeError(`${option} must be a positive integer.`);
	}
	return value;
}

function createSyncRemoteProxy(
	session: SyncRPCClientSession,
	path: readonly string[]
): any {
	const target = function synchronousRemoteProxyTarget() {};
	return new Proxy(target, {
		get(_target, property) {
			if (property === releaseApiProxy) {
				return path.length === 0 ? () => session.release() : undefined;
			}
			if (property === 'then' && path.length === 0) {
				return undefined;
			}
			if (property === 'bind') {
				return undefined;
			}
			if (property === Symbol.toStringTag) {
				return 'SynchronousRemoteAPI';
			}
			if (typeof property === 'symbol') {
				return undefined;
			}
			return createSyncRemoteProxy(session, [...path, property]);
		},
		apply(_target, _thisArgument, args) {
			return session.call(path, args);
		},
		set() {
			throw new RPCUnsupportedOperationError('property assignment');
		},
		construct() {
			throw new RPCUnsupportedOperationError('construction');
		},
	});
}

function isSyncEnvelope(value: unknown): value is SyncRPCEnvelope {
	return (
		isRecord(value) &&
		value['protocol'] === RPC_PROTOCOL_MARKER &&
		isProtocolVersion(value['version']) &&
		typeof value['session'] === 'string' &&
		typeof value['kind'] === 'string'
	);
}

function writeSyncPayload(
	sharedBuffer: SharedArrayBuffer,
	statusCode: number,
	payload: string
): void {
	const status = new Int32Array(sharedBuffer, 0, 2);
	const bytes = new TextEncoder().encode(payload);
	const destination = new Uint8Array(sharedBuffer, 8);
	if (Atomics.load(status, 0) !== SYNC_STATUS_WAITING) return;
	if (bytes.byteLength > destination.byteLength) {
		writeSyncStatus(sharedBuffer, SYNC_STATUS_RESPONSE_TOO_LARGE);
		return;
	}
	destination.set(bytes);
	Atomics.store(status, 1, bytes.byteLength);
	if (
		Atomics.compareExchange(status, 0, SYNC_STATUS_WAITING, statusCode) ===
		SYNC_STATUS_WAITING
	) {
		Atomics.notify(status, 0);
	}
}

function writeSyncStatus(
	sharedBuffer: SharedArrayBuffer,
	statusCode: number
): void {
	const status = new Int32Array(sharedBuffer, 0, 2);
	if (
		Atomics.compareExchange(status, 0, SYNC_STATUS_WAITING, statusCode) ===
		SYNC_STATUS_WAITING
	) {
		Atomics.notify(status, 0);
	}
}

const SYNC_TYPE_MARKER = '__wordpressPlaygroundRPCSyncType__';

function encodeSyncData(value: unknown): string {
	return JSON.stringify({ value }, (_key, nestedValue) => {
		if (typeof nestedValue === 'bigint') {
			return { [SYNC_TYPE_MARKER]: 'bigint', value: String(nestedValue) };
		}
		if (typeof nestedValue === 'undefined') {
			return { [SYNC_TYPE_MARKER]: 'undefined' };
		}
		if (typeof nestedValue === 'number' && !Number.isFinite(nestedValue)) {
			return { [SYNC_TYPE_MARKER]: 'number', value: String(nestedValue) };
		}
		if (
			typeof nestedValue === 'function' ||
			typeof nestedValue === 'symbol'
		) {
			throw new TypeError(
				'Synchronous RPC does not support functions or symbols.'
			);
		}
		if (nestedValue instanceof Map) {
			return {
				[SYNC_TYPE_MARKER]: 'map',
				value: [...nestedValue.entries()],
			};
		}
		if (nestedValue instanceof Set) {
			return { [SYNC_TYPE_MARKER]: 'set', value: [...nestedValue] };
		}
		if (nestedValue instanceof Uint8Array) {
			return {
				[SYNC_TYPE_MARKER]: 'uint8array',
				value: [...nestedValue],
			};
		}
		if (nestedValue instanceof ArrayBuffer) {
			return {
				[SYNC_TYPE_MARKER]: 'arraybuffer',
				value: [...new Uint8Array(nestedValue)],
			};
		}
		return nestedValue;
	});
}

function decodeSyncData(payload: string): unknown {
	const decoded = JSON.parse(payload, (_key, nestedValue) => {
		if (!isRecord(nestedValue) || !(SYNC_TYPE_MARKER in nestedValue)) {
			return nestedValue;
		}
		switch (nestedValue[SYNC_TYPE_MARKER]) {
			case 'bigint':
				return BigInt(nestedValue['value']);
			case 'undefined':
				return undefined;
			case 'number':
				if (nestedValue['value'] === 'NaN') return Number.NaN;
				if (nestedValue['value'] === 'Infinity')
					return Number.POSITIVE_INFINITY;
				if (nestedValue['value'] === '-Infinity')
					return Number.NEGATIVE_INFINITY;
				throw new TypeError('Invalid synchronous RPC number encoding.');
			case 'map':
				return new Map(nestedValue['value']);
			case 'set':
				return new Set(nestedValue['value']);
			case 'uint8array':
				return new Uint8Array(nestedValue['value']);
			case 'arraybuffer':
				return new Uint8Array(nestedValue['value']).buffer;
			default:
				throw new TypeError('Unknown synchronous RPC value encoding.');
		}
	});
	return decoded['value'];
}

function encodeSyncThrown(value: unknown): RPCWireThrown {
	return encodeThrown(value, (nested) => ({
		wire: { representation: 'clone', value: nested },
		transferables: [],
	})).wire;
}

function decodeSyncThrown(value: unknown): unknown {
	return decodeThrown(value as RPCWireThrown, (nested) => nested.value);
}

function unrefTimeout(timer: ReturnType<typeof setTimeout>): void {
	if (
		typeof timer === 'object' &&
		timer !== null &&
		'unref' in timer &&
		typeof timer.unref === 'function'
	) {
		timer.unref();
	}
}
