/**
 * Manages real TCPOverFetchWebSocket instances on the main
 * thread for the JSPI polyfill.
 *
 * The worker communicates socket operations (open, send,
 * recv, close) via SharedArrayBuffer requests. This class
 * translates those into actual WebSocket/fetch operations
 * that can run on the main thread's event loop.
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
		entry.ws.send(data.buffer);
	}

	async recvFromSocket(
		socketId: number,
		maxSize: number
	): Promise<Uint8Array> {
		const entry = this.sockets.get(socketId);
		if (!entry) return new Uint8Array(0);

		// Return from buffer if available.
		if (entry.buffered.length > 0) {
			return consumeBuffer(entry, maxSize);
		}

		// Read from stream with timeout to avoid
		// permanently blocking the main thread handler.
		const result = await Promise.race([
			entry.reader.read(),
			timeout(RECV_TIMEOUT_MS),
		]);

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
}

function consumeBuffer(entry: SocketEntry, maxSize: number): Uint8Array {
	const toReturn = entry.buffered.subarray(
		0,
		Math.min(maxSize, entry.buffered.length)
	);
	entry.buffered = entry.buffered.subarray(toReturn.length);
	return toReturn;
}

function timeout(ms: number): Promise<{ done: true; value: undefined }> {
	return new Promise((resolve) =>
		setTimeout(() => resolve({ done: true, value: undefined }), ms)
	);
}
