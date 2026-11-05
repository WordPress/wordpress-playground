/**
 * Lets PHP open outbound TCP connections in Node.js.
 *
 * Emscripten implements sockets with WebSockets, and WebAssembly has no
 * network access of its own. Emscripten creates those WebSockets through the
 * `websocket.decorator` option, so we give it a class with the subset of the
 * `ws` API it uses, backed by a TCP connection in the same process.
 *
 * CAUTION: Do not replace this with a WebSocket server. A server would need
 * a listening port, and any program or web page on the machine could then use
 * it to open TCP connections as this Node.js process.
 */
import * as dns from 'dns';
import { EventEmitter } from 'events';
import * as net from 'net';
import { debugLog } from './utils';

function log(...args: any[]) {
	debugLog('[Outbound TCP]', ...args);
}

const SOL_SOCKET = 1;
const SO_KEEPALIVE = 9;
const IPPROTO_TCP = 6;
const TCP_NODELAY = 1;

/**
 * Builds the URL Emscripten passes to the socket constructor.
 *
 * Nothing listens at this URL. It only carries the target host and port.
 */
export function getOutboundTcpSocketUrl(host: string, port: string) {
	const query = new URLSearchParams({ host, port }).toString();
	return `tcp://php-wasm/?${query}`;
}

/**
 * Creates a socket class for one PHP runtime.
 *
 * Its `closeAll()` method closes the runtime's open connections when the
 * runtime exits.
 */
export function createOutboundTcpSocketClass() {
	const openSockets = new Set<OutboundTcpSocket>();
	return class RuntimeOutboundTcpSocket extends OutboundTcpSocket {
		static closeAll() {
			for (const socket of openSockets) {
				socket.close();
			}
		}

		constructor(url: string) {
			super(url);
			openSockets.add(this);
			this.once('close', () => openSockets.delete(this));
		}
	};
}

/**
 * A TCP connection with the subset of the `ws` WebSocket API that
 * Emscripten's SOCKFS and the php-wasm socket functions use.
 */
export class OutboundTcpSocket extends EventEmitter {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;

	readonly CONNECTING = OutboundTcpSocket.CONNECTING;
	readonly OPEN = OutboundTcpSocket.OPEN;
	readonly CLOSING = OutboundTcpSocket.CLOSING;
	readonly CLOSED = OutboundTcpSocket.CLOSED;

	readonly url: string;
	readyState: number = OutboundTcpSocket.CONNECTING;
	binaryType = 'arraybuffer';
	private target?: net.Socket;

	constructor(url: string) {
		super();
		this.url = url;
		const { searchParams } = new URL(url);
		this.connect(
			searchParams.get('host'),
			Number(searchParams.get('port'))
		);
	}

	send(data: ArrayBuffer | ArrayBufferView) {
		if (this.readyState !== this.OPEN) {
			throw new Error('The TCP connection is not open');
		}
		const bytes = ArrayBuffer.isView(data)
			? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
			: new Uint8Array(data);
		this.target!.write(bytes);
	}

	setSocketOpt(level: number, optionName: number, optionValue: number) {
		if (level === SOL_SOCKET && optionName === SO_KEEPALIVE) {
			this.target?.setKeepAlive(Boolean(optionValue));
		} else if (level === IPPROTO_TCP && optionName === TCP_NODELAY) {
			this.target?.setNoDelay(Boolean(optionValue));
		}
	}

	close() {
		this.shutDown();
	}

	addEventListener(event: string, listener: (...args: any[]) => void) {
		this.on(event, listener);
	}

	removeEventListener(event: string, listener: (...args: any[]) => void) {
		this.off(event, listener);
	}

	private async connect(host: string | null, port: number) {
		if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
			this.shutDown(new Error(`Invalid TCP address: ${host}:${port}`));
			return;
		}

		let ip = host;
		if (net.isIP(host) === 0) {
			try {
				ip = await lookupIPv4(host);
			} catch (e) {
				this.shutDown(e as Error);
				return;
			}
			// PHP may have closed the socket during the lookup.
			if (this.readyState !== this.CONNECTING) {
				return;
			}
		}

		log(`Connecting to ${ip}:${port}`);
		const target = net.createConnection(port, ip);
		this.target = target;
		target.on('connect', () => {
			if (this.readyState === this.CONNECTING) {
				this.readyState = this.OPEN;
				this.emit('open');
			}
		});
		target.on('data', (data: Buffer) => {
			// Emscripten ignores messages that aren't marked as binary.
			this.emit('message', data, true);
		});
		target.on('end', () => this.shutDown());
		target.on('error', (e) => this.shutDown(e));
	}

	/**
	 * Closes the connection and emits `close` on the next tick, like `ws`.
	 *
	 * Only a connection that never opened emits `error`. Emscripten records it
	 * as a refused connection. An established connection that fails closes
	 * without an error, so PHP reads the end of the stream.
	 */
	private shutDown(error?: Error) {
		if (
			this.readyState === this.CLOSING ||
			this.readyState === this.CLOSED
		) {
			return;
		}
		const wasOpen = this.readyState === this.OPEN;
		if (error) {
			log('Connection error', error);
		}
		this.readyState = this.CLOSING;
		if (wasOpen && !error) {
			this.target!.end();
		} else {
			this.target?.destroy();
		}
		process.nextTick(() => {
			this.readyState = this.CLOSED;
			if (error && !wasOpen && this.listenerCount('error') > 0) {
				this.emit('error', error);
			}
			this.emit('close');
		});
	}
}

/**
 * Resolve a hostname to an IPv4 address.
 * Prefers IPv4 because many services (including Redis) only listen on IPv4
 * by default, and macOS's dns.lookup returns IPv6 for 'localhost'.
 */
function lookupIPv4(hostname: string): Promise<string> {
	return new Promise((resolve, reject) => {
		dns.lookup(hostname, { family: 4 }, (err, address) => {
			if (err) {
				reject(err);
			} else {
				resolve(address);
			}
		});
	});
}
