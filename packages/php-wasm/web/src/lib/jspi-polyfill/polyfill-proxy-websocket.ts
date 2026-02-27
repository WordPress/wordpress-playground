/**
 * Worker-side WebSocket replacement for the JSPI polyfill.
 *
 * Instead of making real network connections (which require
 * an active event loop), this class routes all I/O through
 * the SharedArrayBuffer channel to the main thread, where
 * a real TCPOverFetchWebSocket handles fetch() calls.
 *
 * Implements the subset of the WebSocket API that
 * Emscripten's SOCKFS needs.
 */

import type { SharedChannel } from './shared-channel';
import {
	sendRequestFromWorker,
	REQUEST_SOCKET_OPEN,
	REQUEST_SOCKET_SEND,
	REQUEST_SOCKET_CLOSE,
} from './shared-channel';

let polyfillChannel: SharedChannel | null = null;
let nextSocketId = 1;

export function setPolyfillChannel(channel: SharedChannel): void {
	polyfillChannel = channel;
}

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

	readonly socketId: number;
	readyState = 0; // CONNECTING
	binaryType = 'arraybuffer';

	// Event handler stubs for SOCKFS compatibility.
	// SOCKFS sets onmessage to buffer incoming data, but in
	// polyfill mode data bypasses SOCKFS entirely via the
	// wasm_recv replacement.
	onopen: ((event: unknown) => void) | null = null;
	onclose: ((event: unknown) => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;
	onmessage: ((event: unknown) => void) | null = null;

	constructor(url: string) {
		if (!polyfillChannel) {
			throw new Error(
				'PolyfillProxyWebSocket: channel not set. ' +
					'Call setPolyfillChannel() first.'
			);
		}

		this.socketId = nextSocketId++;
		PolyfillProxyWebSocket.lastCreatedSocketId = this.socketId;

		// Parse host/port from the playground.internal URL
		// format: ws://playground.internal/?host=X&port=Y
		const parsed = new URL(url);
		const host = parsed.searchParams.get('host') ?? '';
		const port = parseInt(parsed.searchParams.get('port') ?? '0', 10);
		const hostBytes = new TextEncoder().encode(host);

		// Block until the main thread creates the real socket.
		sendRequestFromWorker(
			polyfillChannel,
			REQUEST_SOCKET_OPEN,
			[this.socketId, port],
			hostBytes
		);

		this.readyState = 1; // OPEN
		this.binaryType = 'arraybuffer';
	}

	send(data: ArrayBuffer): void {
		if (!polyfillChannel || this.readyState !== 1) return;

		sendRequestFromWorker(
			polyfillChannel,
			REQUEST_SOCKET_SEND,
			[this.socketId],
			new Uint8Array(data)
		);
	}

	close(): void {
		if (!polyfillChannel || this.readyState >= 2) return;

		sendRequestFromWorker(polyfillChannel, REQUEST_SOCKET_CLOSE, [
			this.socketId,
		]);
		this.readyState = 3; // CLOSED
	}

	addEventListener(): void {
		// No-op stub for SOCKFS compatibility.
	}

	removeEventListener(): void {
		// No-op stub for SOCKFS compatibility.
	}
}
