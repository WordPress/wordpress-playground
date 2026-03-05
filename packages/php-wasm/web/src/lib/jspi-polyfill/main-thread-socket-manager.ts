/**
 * Manages TCP socket instances for the JSPI polyfill.
 *
 * Translates socket operations (open, send, recv, close)
 * into actual WebSocket/fetch operations via
 * TCPOverFetchWebSocket.
 *
 * Used by the service worker handler (sw-handler.ts).
 */

import type { TCPOverFetchOptions } from '../tcp-over-fetch-websocket';
import { TCPOverFetchWebsocket } from '../tcp-over-fetch-websocket';

const RECV_TIMEOUT_MS = 30_000;

interface SocketEntry {
	ws: TCPOverFetchWebsocket;
	reader: ReadableStreamDefaultReader<Uint8Array>;
	buffered: Uint8Array;
}

export class MainThreadSocketManager {
	private sockets = new Map<number, SocketEntry>();
	private tcpOptions: TCPOverFetchOptions;

	constructor(tcpOptions: TCPOverFetchOptions) {
		this.tcpOptions = tcpOptions;
	}

	createSocket(socketId: number, host: string, port: number): void {
		const url = `ws://playground.internal/?host=${encodeURIComponent(host)}&port=${port}`;
		const ws = new TCPOverFetchWebsocket(url, ['binary'], {
			CAroot: this.tcpOptions.CAroot,
			corsProxyUrl: this.tcpOptions.corsProxyUrl,
			outputType: 'stream',
		});
		const reader =
			ws.clientDownstream.readable.getReader() as ReadableStreamDefaultReader<Uint8Array>;
		this.sockets.set(socketId, {
			ws,
			reader,
			buffered: new Uint8Array(0),
		});
	}

	sendToSocket(socketId: number, data: Uint8Array): void {
		const entry = this.sockets.get(socketId);
		if (!entry) return;
		entry.ws.send(
			data.buffer.slice(
				data.byteOffset,
				data.byteOffset + data.byteLength
			)
		);
	}

	async recvFromSocket(
		socketId: number,
		maxSize: number
	): Promise<Uint8Array> {
		const entry = this.sockets.get(socketId);
		if (!entry) {
			return new Uint8Array(0);
		}

		if (entry.buffered.length > 0) {
			return consumeBuffer(entry, maxSize);
		}

		let timer: ReturnType<typeof setTimeout>;
		const timeoutPromise = new Promise<{
			done: true;
			value: undefined;
		}>((resolve) => {
			timer = setTimeout(
				() => resolve({ done: true, value: undefined }),
				RECV_TIMEOUT_MS
			);
		});

		const result = await Promise.race([
			entry.reader.read(),
			timeoutPromise,
		]);
		clearTimeout(timer!);

		if (result.done || !result.value) {
			return new Uint8Array(0);
		}

		entry.buffered = result.value;
		return consumeBuffer(entry, maxSize);
	}

	closeSocket(socketId: number): void {
		const entry = this.sockets.get(socketId);
		if (!entry) return;
		entry.reader.releaseLock();
		entry.ws.close();
		this.sockets.delete(socketId);
	}

	/**
	 * Closes all open sockets. Called during runtime
	 * rotation to prevent resource leaks.
	 */
	closeAll(): void {
		for (const socketId of this.sockets.keys()) {
			this.closeSocket(socketId);
		}
	}
}

function consumeBuffer(entry: SocketEntry, maxSize: number): Uint8Array {
	const end = Math.min(maxSize, entry.buffered.length);
	// slice() copies so the returned data and the remaining
	// buffer don't share the same backing ArrayBuffer.
	const toReturn = entry.buffered.slice(0, end);
	entry.buffered = entry.buffered.subarray(end);
	return toReturn;
}
