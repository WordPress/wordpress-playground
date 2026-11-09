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
import * as dns from 'dns';
import { EventEmitter } from 'events';
import * as net from 'net';
import { debugLog } from './utils';

function log(...args: any[]) {
	debugLog('[TCP]', ...args);
}

// How long a socket may keep sending after the runtime exits. It gives the peer
// time to read what PHP wrote, while bounding how long a peer that never reads
// or closes can hold the socket and delay a process exit.
export const RELEASED_SOCKET_TIMEOUT_MS = 30_000;

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

	// Emscripten compares readyState with these on the instance, like
	// `ws.readyState === ws.OPEN`.
	readonly CONNECTING = TcpSocket.CONNECTING;
	readonly OPEN = TcpSocket.OPEN;
	readonly CLOSING = TcpSocket.CLOSING;
	readonly CLOSED = TcpSocket.CLOSED;

	readyState: number;
	// Emscripten sets this. The socket always delivers binary data.
	binaryType = 'arraybuffer';
	/**
	 * Emscripten reads the address of an accepted connection's peer from
	 * `_socket`, like it does for `ws` WebSockets.
	 */
	readonly _socket?: net.Socket;
	private released = false;

	constructor(socket: net.Socket | undefined, readyState: number) {
		super();
		this._socket = socket;
		this.readyState = readyState;
		socket?.on('data', (data: Buffer) => {
			// The socket is closed, so nothing will read this data. Drop it rather
			// than resetting the connection: a reset makes the kernel discard what
			// PHP wrote but the peer hasn't received yet. The socket closes when
			// the peer closes its side, or after a timeout once the runtime exits.
			if (
				this.readyState === this.CLOSING ||
				this.readyState === this.CLOSED
			) {
				return;
			}
			// There's no backpressure: data goes to Emscripten as it arrives, as it
			// did with the WebSocket proxy. Emscripten doesn't tell us when PHP has
			// read it, so we can't pause the socket until then.
			// Emscripten ignores messages that aren't marked as binary.
			this.emit('message', data, true);
		});
		// Emscripten has no half-closed state. PHP reads the data it already
		// received and then the end of the stream.
		socket?.on('end', () => this.shutDown());
		// Close without emitting `error`, so PHP reads the end of the stream as it
		// did with the WebSocket proxy. See the CAUTION on OutboundTcpSocket.
		socket?.on('error', (error) => {
			log('Connection error', error);
			this.shutDown(true);
		});
	}

	send(data: ArrayBuffer | ArrayBufferView) {
		if (this.readyState !== this.OPEN || !this._socket) {
			throw new Error('The TCP connection is not open');
		}
		const bytes = ArrayBuffer.isView(data)
			? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
			: new Uint8Array(data);
		this._socket.write(bytes);
	}

	/**
	 * For php-wasm's setsockopt() with SO_KEEPALIVE and TCP_NODELAY. The current
	 * PHP builds look the socket up by file descriptor and never find it, so
	 * this isn't called yet. They also pass a pointer to the option's value
	 * rather than the value, so a fixed lookup alone would turn every option on.
	 */
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
	 * Releases the TCP socket when the runtime exits.
	 *
	 * End the write side so queued writes can drain, including those on
	 * persistent sockets PHP left open. Unref the socket so it doesn't keep
	 * Node.js running once those writes are sent. A timeout bounds how long
	 * pending writes or a peer that never closes can retain the connection.
	 *
	 * Ending rather than destroying means the peer sees a normal end of stream,
	 * even for a connection PHP left open mid-conversation, because destroying
	 * would discard PHP's queued writes.
	 */
	release() {
		if (this.released) {
			return;
		}
		this.released = true;
		const socket = this._socket;
		// Don't wait for an unused connection attempt after the runtime exits.
		// A connecting socket with queued writes still needs to drain them.
		// Writes PHP made before the socket reported itself open are still in
		// Emscripten's own queue, not Node.js's, and are lost, as they were with
		// the WebSocket proxy.
		this.shutDown(socket?.connecting && socket.writableLength === 0);
		// The runtime cancels pending waits before releasing sockets. Detach
		// remaining Emscripten listeners as well, so draining TCP cannot send
		// events into exited PHP. TCP's own listeners stay to drain queued writes.
		this.removeAllListeners();
		if (!socket || socket.destroyed) {
			return;
		}
		socket.unref();
		const timeout = setTimeout(
			() => socket.destroy(),
			RELEASED_SOCKET_TIMEOUT_MS
		);
		timeout.unref();
		// Cancel the timer once TCP closes, so it doesn't keep the closed
		// socket in memory for the rest of the timeout.
		socket.once('close', () => clearTimeout(timeout));
	}

	// php-wasm's connect() listens with the DOM-style event API.
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
		// Destroy even if the socket already closed for PHP: a close only ends
		// the write side, so TCP can still be connecting or sending. release()
		// relies on this to stop a connection attempt nothing will use.
		if (destroy) {
			this._socket?.destroy();
		}
		if (
			this.readyState === this.CLOSING ||
			this.readyState === this.CLOSED
		) {
			return;
		}
		this.readyState = this.CLOSING;
		if (!destroy) {
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
		// Emscripten attaches its listeners after the constructor returns.
		process.nextTick(() => {
			if (this.readyState !== this.CONNECTING) {
				return;
			}
			this.readyState = this.OPEN;
			this.emit('open');
			// Treat an invalid address like a failed connection: open, then close.
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
 * connection as a `TcpSocket`. Listening only there, rather than on every
 * interface like the WebSocket bridge, keeps a server bound to 127.0.0.1 off
 * the network. As a result, a server bound to `localhost`, which PHP resolves
 * to 127.0.0.1, doesn't accept IPv6 clients.
 *
 * CAUTION: An error before the server listens, such as EADDRINUSE, is left
 * unhandled so that it stops the process. Emscripten's listen() has already
 * returned by then, so PHP can't report it. If the error reached PHP's socket,
 * PHP would wait for connections forever. The cost is that PHP code binding a
 * busy port, an address that isn't local, or a hostname that doesn't resolve
 * stops the whole process, such as a Playground CLI worker.
 */
export class TcpServer extends EventEmitter {
	// php-wasm's poll() waits on these for data on a listening socket. Its
	// select() also checks a read set for writability, and an open socket is
	// always writable. A socket leaves this set only when it closes, so
	// stream_select() reports the listening socket ready while any connection
	// to it is open, including one PHP already accepted, and before its data
	// arrives. `ws` servers' clients behaved the same way.
	readonly clients = new Set<TcpSocket>();
	private readonly server: net.Server;
	private closed = false;

	constructor({ host, port }: TcpServerOptions) {
		super();
		this.server = net.createServer((socket) => {
			if (this.closed) {
				socket.destroy();
				return;
			}
			// A client that reset the connection before Node.js handled it has
			// no address. Emscripten's accept() fails on that with a JavaScript
			// error instead of an errno, so drop the connection.
			if (!socket.remoteAddress) {
				socket.destroy();
				return;
			}
			const client = new TcpSocket(socket, TcpSocket.OPEN);
			this.clients.add(client);
			client.once('close', () => this.clients.delete(client));
			this.emit('connection', client);
		});
		// Forward errors only once the server listens. Earlier errors stay
		// unhandled; see the CAUTION above.
		this.server.on('listening', () => {
			this.server.on('error', (error) => {
				log('Server error', error);
				this.emit('error', error);
			});
			this.emit('listening');
		});
		this.server.on('close', () => this.emit('close'));
		if (host && net.isIP(host) === 0) {
			// Emscripten only represents IPv4 addresses. A hostname that resolves
			// to IPv6 first would make PHP see every client as 0.0.0.0.
			dns.lookup(host, { family: 4 }, (error, address) => {
				// PHP or the runtime may have closed the server during the lookup.
				if (this.closed) {
					return;
				}
				if (error) {
					// Unhandled, like an error from listen().
					this.server.emit('error', error);
				} else {
					this.listen(port, address);
				}
			});
		} else {
			this.listen(port, host);
		}
	}

	address() {
		return this.server.address();
	}

	/**
	 * Stops listening. Connections already made stay open, including ones PHP
	 * hasn't accepted yet.
	 */
	close(callback?: (error?: Error) => void) {
		this.closed = true;
		this.server.close(callback);
	}

	private listen(port: number | undefined, host: string | undefined) {
		log(`Listening on ${host}:${port}`);
		this.server.listen(port, host);
	}
}

function connect(host: string, port: number) {
	log(`Connecting to ${host}:${port}`);
	// Prefer IPv4 because many services (including Redis) only listen on
	// IPv4 by default, and macOS resolves 'localhost' to IPv6 first. `family`
	// only affects hostname lookups; IPv6 addresses still connect directly.
	return net.createConnection({ host, port, family: 4 });
}
