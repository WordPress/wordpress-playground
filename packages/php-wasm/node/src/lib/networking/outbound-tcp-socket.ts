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
export function createOutboundTcpSocketClass(): typeof OutboundTcpSocket & {
	closeAll(): void;
} {
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
 *
 * The socket reports itself open right away and buffers writes until the TCP
 * connection is established, like the WebSocket proxy it replaces. A connection
 * that fails then closes, and PHP reads the end of the stream.
 *
 * CAUTION: Reporting the failure from connect() instead breaks cURL with JSPI.
 * php-wasm's connect() drops a socket whose connection fails, so cURL's polls
 * never see the failure, and it waits until its timeout.
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
		const host = searchParams.get('host');
		const port = Number(searchParams.get('port'));
		if (host && Number.isInteger(port) && port > 0 && port < 65536) {
			this.target = this.connect(host, port);
		} else {
			log(`Invalid TCP address: ${host}:${port}`);
		}
		process.nextTick(() => {
			if (this.readyState !== this.CONNECTING) {
				return;
			}
			this.readyState = this.OPEN;
			this.emit('open');
			if (!this.target) {
				this.shutDown();
			}
		});
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

	private connect(host: string, port: number) {
		log(`Connecting to ${host}:${port}`);
		// Prefer IPv4 because many services (including Redis) only listen on
		// IPv4 by default, and macOS resolves 'localhost' to IPv6 first.
		const target = net.createConnection({ host, port, family: 4 });
		target.on('data', (data: Buffer) => {
			// Emscripten ignores messages that aren't marked as binary.
			this.emit('message', data, true);
		});
		target.on('end', () => this.shutDown());
		target.on('error', (error) => {
			log('Connection error', error);
			this.shutDown(true);
		});
		return target;
	}

	/**
	 * Closes the connection and emits `close` on the next tick, like `ws`.
	 */
	private shutDown(destroy = false) {
		if (
			this.readyState === this.CLOSING ||
			this.readyState === this.CLOSED
		) {
			return;
		}
		this.readyState = this.CLOSING;
		if (destroy) {
			this.target?.destroy();
		} else {
			this.target?.end();
		}
		process.nextTick(() => {
			this.readyState = this.CLOSED;
			this.emit('close');
		});
	}
}
