/**
 * Worker-side WebSocket replacement for the JSPI polyfill.
 *
 * Instead of making real network connections (which require
 * an active event loop), this class routes all socket I/O
 * through synchronous XHR requests to the service worker,
 * where a real TCPOverFetchWebSocket handles the actual
 * connections.
 *
 * Implements the subset of the WebSocket API that
 * Emscripten's SOCKFS needs.
 */

import { sendSyncXhr } from './sync-xhr-channel';

let nextSocketId = 1;

export class PolyfillProxyWebSocket {
	/**
	 * Maps socket file descriptors to socket IDs.
	 * Populated by the __syscall_connect wrapper in
	 * patchAsyncImports after each connect call.
	 */
	static sockfdToSocketId = new Map<number, number>();

	/**
	 * Set in the constructor, read by __syscall_connect
	 * wrapper to associate the sockfd with the socket ID.
	 */
	static lastCreatedSocketId = 0;

	/**
	 * Optional callback invoked on close() to clean up
	 * external state (e.g. recvBuffers in load-runtime.ts).
	 */
	static onSocketClosed: ((socketId: number) => void) | null = null;

	readonly socketId: number;

	// WebSocket readyState constants. SOCKFS checks
	// dest.socket.readyState === dest.socket.OPEN etc.
	// to decide whether to send data immediately or queue
	// it. Without these, the comparisons fail and all data
	// gets stuck in msg_send_queue.
	readonly CONNECTING = 0;
	readonly OPEN = 1;
	readonly CLOSING = 2;
	readonly CLOSED = 3;

	readyState = 0; // CONNECTING
	binaryType = 'arraybuffer';

	// Event handler stubs for SOCKFS compatibility.
	onopen: ((event: unknown) => void) | null = null;
	onclose: ((event: unknown) => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;
	onmessage: ((event: unknown) => void) | null = null;

	constructor(url: string) {
		this.socketId = nextSocketId++;
		PolyfillProxyWebSocket.lastCreatedSocketId = this.socketId;

		// Parse host/port from the playground.internal URL
		// format: ws://playground.internal/?host=X&port=Y
		const parsed = new URL(url);
		const host = parsed.searchParams.get('host') ?? '';
		const port = parsed.searchParams.get('port') ?? '0';

		const response = sendSyncXhr('sock-open', {
			socketId: this.socketId,
			host,
			port,
		});

		if (!response.ok) {
			this.readyState = 3; // CLOSED
			return;
		}

		this.readyState = 1; // OPEN
	}

	send(data: ArrayBuffer): void {
		if (this.readyState !== 1) return;

		sendSyncXhr(
			'sock-send',
			{ socketId: this.socketId },
			new Uint8Array(data)
		);
	}

	close(): void {
		if (this.readyState >= 2) return;

		sendSyncXhr('sock-close', { socketId: this.socketId });
		this.readyState = 3; // CLOSED

		// Clean up FD→socket mappings so that recycled FDs
		// aren't mistaken for polyfilled sockets.
		for (const [fd, id] of PolyfillProxyWebSocket.sockfdToSocketId) {
			if (id === this.socketId) {
				PolyfillProxyWebSocket.sockfdToSocketId.delete(fd);
				break;
			}
		}
		PolyfillProxyWebSocket.onSocketClosed?.(this.socketId);
	}

	addEventListener(): void {
		// No-op stub for SOCKFS compatibility.
	}

	removeEventListener(): void {
		// No-op stub for SOCKFS compatibility.
	}
}
