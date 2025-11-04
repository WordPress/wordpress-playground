/**
 * Network WebSocket that routes connections through a findConnector function.
 *
 * This is a replacement for TCPOverFetchWebsocket that uses the new
 * connector-based architecture, making it easy to add custom handlers
 * for different protocols and ports.
 */

import type { EmscriptenOptions } from '@php-wasm/universal';
import type { NetworkConnection, ConnectToFunction } from '@php-wasm/util';

export interface NetworkWebsocketOptions {
	/**
	 * Function to find the appropriate connector for a connection.
	 */
	connectTo: ConnectToFunction;

	/**
	 * Output type for the websocket.
	 * - 'messages': Emit 'message' events (default, for Emscripten)
	 * - 'stream': Return clientDownstream stream directly
	 */
	outputType?: 'messages' | 'stream';
}

/**
 * Creates Emscripten options with network connector support.
 */
export function withNetworkConnectors(
	emOptions: EmscriptenOptions,
	options: NetworkWebsocketOptions
): EmscriptenOptions {
	const { connectTo } = options;

	return {
		...emOptions,
		websocket: {
			url: (_: any, host: string, port: string) => {
				const query = new URLSearchParams({
					host,
					port,
				}).toString();
				return `ws://playground.internal/?${query}`;
			},
			subprotocol: 'binary',
			decorator: () => {
				return class extends NetworkWebsocket {
					constructor(url: string, wsOptions: string[]) {
						super(url, wsOptions, {
							connectTo,
							outputType: options.outputType || 'messages',
						});
					}
				};
			},
		},
	};
}

interface NetworkWebsocketConstructorOptions {
	connectTo: ConnectToFunction;
	outputType?: 'messages' | 'stream';
}

export class NetworkWebsocket {
	CONNECTING = 0;
	OPEN = 1;
	CLOSING = 2;
	CLOSED = 3;
	readyState = this.CONNECTING;
	binaryType = 'blob';
	bufferedAmount = 0;
	extensions = '';
	protocol = 'ws';
	host = '';
	port = 0;
	listeners = new Map<string, Set<any>>();

	clientUpstream = new TransformStream<Uint8Array>();
	clientUpstreamWriter = this.clientUpstream.writable.getWriter();
	clientDownstream = new TransformStream<Uint8Array>();

	url: string;
	options: string[];
	connectTo: ConnectToFunction;

	constructor(
		url: string,
		options: string[],
		{
			connectTo,
			outputType = 'messages',
		}: NetworkWebsocketConstructorOptions
	) {
		console.log('NetworkWebsocket constructor', url, options, connectTo);
		this.url = url;
		this.options = options;
		this.connectTo = connectTo;

		const wsUrl = new URL(url);
		this.host = wsUrl.searchParams.get('host')!;
		this.port = parseInt(wsUrl.searchParams.get('port')!, 10);
		this.binaryType = 'arraybuffer';

		if (outputType === 'messages') {
			this.clientDownstream.readable
				.pipeTo(
					new WritableStream({
						write: (chunk) => {
							this.emit('message', { data: chunk });
						},
						abort: () => {
							this.emit('error', new Error('ECONNREFUSED'));
							this.close();
						},
						close: () => {
							this.close();
						},
					})
				)
				.catch(() => {
					// Errors communicated via 'error' event
				});
		}

		this.readyState = this.OPEN;
		this.emit('open');

		// Start connection handling
		this.handleConnection();
	}

	async handleConnection() {
		try {
			const connector = this.connectTo({
				port: this.port,
				host: this.host,
			});

			if (!connector) {
				throw new Error(
					`No connector found for ${this.host}:${this.port}`
				);
			}

			const connection: NetworkConnection = {
				host: this.host,
				port: this.port,
				upstream: this.clientUpstream.readable,
				downstream: this.clientDownstream.writable,
			};

			await connector.connect(connection);
		} catch (error) {
			this.emit('error', error);
			this.close();
		}
	}

	on(eventName: string, callback: (e: any) => void) {
		this.addEventListener(eventName, callback);
	}

	once(eventName: string, callback: (e: any) => void) {
		const wrapper = (e: any) => {
			callback(e);
			this.removeEventListener(eventName, wrapper);
		};
		this.addEventListener(eventName, wrapper);
	}

	addEventListener(eventName: string, callback: (e: any) => void) {
		if (!this.listeners.has(eventName)) {
			this.listeners.set(eventName, new Set());
		}
		this.listeners.get(eventName)!.add(callback);
	}

	removeListener(eventName: string, callback: (e: any) => void) {
		this.removeEventListener(eventName, callback);
	}

	removeEventListener(eventName: string, callback: (e: any) => void) {
		const listeners = this.listeners.get(eventName);
		if (listeners) {
			listeners.delete(callback);
		}
	}

	emit(eventName: string, data: any = {}) {
		if (eventName === 'message') {
			this.onmessage(data);
		} else if (eventName === 'close') {
			this.onclose(data);
		} else if (eventName === 'error') {
			this.onerror(data);
		} else if (eventName === 'open') {
			this.onopen(data);
		}
		const listeners = this.listeners.get(eventName);
		if (listeners) {
			for (const listener of listeners) {
				listener(data);
			}
		}
	}

	// Default event handlers
	onclose(data: any) {}
	onerror(data: any) {}
	onmessage(data: any) {}
	onopen(data: any) {}

	/**
	 * Emscripten calls this when WASM writes to the socket
	 */
	send(data: ArrayBuffer) {
		if (
			this.readyState === this.CLOSING ||
			this.readyState === this.CLOSED
		) {
			return;
		}
		this.clientUpstreamWriter.write(new Uint8Array(data));
	}

	close() {
		// Send empty data chunk before closing (PHP.wasm workaround)
		this.emit('message', { data: new Uint8Array(0) });

		this.readyState = this.CLOSING;
		this.emit('close');
		this.readyState = this.CLOSED;
	}
}
