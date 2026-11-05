/**
 * Lets PHP open and accept TCP connections in Node.js.
 *
 * Emscripten implements sockets with WebSockets, and WebAssembly has no
 * network access of its own. Emscripten creates WebSockets through the
 * `websocket.decorator` option and WebSocket servers through
 * `websocket.serverDecorator`. We give it classes with the subset of the `ws`
 * API it uses, backed by TCP sockets and servers in the same process.
 *
 * CAUTION: Do not route PHP's connections through a local WebSocket server.
 * Any program or web page on the machine could connect to it and use PHP's
 * connections, or open TCP connections as this Node.js process.
 */
import { EventEmitter } from 'events';
import * as net from 'net';
import { debugLog } from './utils';

function log(...args: any[]) {
	debugLog('[TCP]', ...args);
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
 * A TCP connection with the subset of the `ws` WebSocket API that
 * Emscripten's SOCKFS and the php-wasm socket functions use.
 */
export class TcpSocket extends EventEmitter {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;

	readonly CONNECTING = TcpSocket.CONNECTING;
	readonly OPEN = TcpSocket.OPEN;
	readonly CLOSING = TcpSocket.CLOSING;
	readonly CLOSED = TcpSocket.CLOSED;

	readyState: number;
	binaryType = 'arraybuffer';
	/**
	 * Emscripten reads the address of an accepted connection's peer from
	 * `_socket`, like it does for `ws` WebSockets.
	 */
	readonly _socket?: net.Socket;

	constructor(socket: net.Socket | undefined, readyState: number) {
		super();
		this._socket = socket;
		this.readyState = readyState;
		socket?.on('data', (data: Buffer) => {
			// Emscripten ignores messages that aren't marked as binary.
			this.emit('message', data, true);
		});
		socket?.on('end', () => this.shutDown());
		socket?.on('error', (error) => {
			log('Connection error', error);
			this.shutDown(true);
		});
	}

	send(data: ArrayBuffer | ArrayBufferView) {
		if (this.readyState !== this.OPEN) {
			throw new Error('The TCP connection is not open');
		}
		const bytes = ArrayBuffer.isView(data)
			? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
			: new Uint8Array(data);
		this._socket!.write(bytes);
	}

	setSocketOpt(level: number, optionName: number, optionValue: number) {
		if (level === SOL_SOCKET && optionName === SO_KEEPALIVE) {
			this._socket?.setKeepAlive(Boolean(optionValue));
		} else if (level === IPPROTO_TCP && optionName === TCP_NODELAY) {
			this._socket?.setNoDelay(Boolean(optionValue));
		}
	}

	close() {
		this.shutDown();
	}

	/**
	 * Releases the TCP socket right away. A socket that PHP closed stays
	 * open until the peer closes its side, so this also releases those.
	 */
	destroy() {
		this._socket?.destroy();
		this.shutDown(true);
	}

	addEventListener(event: string, listener: (...args: any[]) => void) {
		this.on(event, listener);
	}

	removeEventListener(event: string, listener: (...args: any[]) => void) {
		this.off(event, listener);
	}

	/**
	 * Closes the connection and emits `close` on the next tick, like `ws`.
	 */
	protected shutDown(destroy = false) {
		if (
			this.readyState === this.CLOSING ||
			this.readyState === this.CLOSED
		) {
			return;
		}
		this.readyState = this.CLOSING;
		if (destroy) {
			this._socket?.destroy();
		} else {
			this._socket?.end();
		}
		process.nextTick(() => {
			this.readyState = this.CLOSED;
			this.emit('close');
		});
	}
}

/**
 * A TCP connection PHP opens.
 *
 * The socket reports itself open right away and buffers writes until the TCP
 * connection is established, like the WebSocket proxy it replaces. A connection
 * that fails then closes, and PHP reads the end of the stream.
 *
 * CAUTION: Reporting the failure from connect() instead breaks cURL with JSPI.
 * php-wasm's connect() drops a socket whose connection fails, so cURL's polls
 * never see the failure, and it waits until its timeout.
 */
export class OutboundTcpSocket extends TcpSocket {
	readonly url: string;

	constructor(url: string) {
		const { searchParams } = new URL(url);
		const host = searchParams.get('host');
		const port = Number(searchParams.get('port'));
		const isValid =
			!!host && Number.isInteger(port) && port > 0 && port < 65536;
		if (!isValid) {
			log(`Invalid TCP address: ${host}:${port}`);
		}
		super(isValid ? connect(host, port) : undefined, TcpSocket.CONNECTING);
		this.url = url;
		process.nextTick(() => {
			if (this.readyState !== this.CONNECTING) {
				return;
			}
			this.readyState = this.OPEN;
			this.emit('open');
			if (!this._socket) {
				this.shutDown();
			}
		});
	}
}

export interface TcpServerOptions {
	host?: string;
	port?: number;
}

/**
 * A TCP server PHP listens on, with the subset of the `ws` WebSocketServer
 * API that Emscripten's SOCKFS uses.
 *
 * It listens on the host and port PHP binds to, and emits each accepted
 * connection as a `TcpSocket`.
 */
export class TcpServer extends EventEmitter {
	readonly clients = new Set<TcpSocket>();
	private readonly server: net.Server;

	constructor({ host, port }: TcpServerOptions) {
		super();
		this.server = net.createServer((socket) => {
			const client = new TcpSocket(socket, TcpSocket.OPEN);
			this.clients.add(client);
			client.once('close', () => this.clients.delete(client));
			this.emit('connection', client);
		});
		this.server.on('listening', () => this.emit('listening'));
		this.server.on('close', () => this.emit('close'));
		this.server.on('error', (error) => {
			log('Server error', error);
			this.emit('error', error);
		});
		log(`Listening on ${host}:${port}`);
		this.server.listen(port, host);
	}

	address() {
		return this.server.address();
	}

	/**
	 * Stops accepting connections. Accepted connections stay open, like
	 * closing a listening socket.
	 */
	close(callback?: (error?: Error) => void) {
		this.server.close(callback);
	}
}

function connect(host: string, port: number) {
	log(`Connecting to ${host}:${port}`);
	// Prefer IPv4 because many services (including Redis) only listen on
	// IPv4 by default, and macOS resolves 'localhost' to IPv6 first.
	return net.createConnection({ host, port, family: 4 });
}
