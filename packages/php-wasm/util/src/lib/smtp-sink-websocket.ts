import { SmtpSink, makeLoopbackPair, type CaughtMessage } from './smtp';

/**
 * A WebSocket-shaped class that pipes outbound bytes through an in-process
 * SmtpSink instead of opening a real network connection. Used to intercept
 * Emscripten's SMTP-bound TCP traffic.
 */
export class SmtpSinkWebSocket {
	readonly CONNECTING = 0;
	readonly OPEN = 1;
	readonly CLOSING = 2;
	readonly CLOSED = 3;

	readyState = this.CONNECTING;

	url: string;
	protocol = '';
	binaryType: 'arraybuffer' | 'blob' = 'arraybuffer';
	extensions = '';
	bufferedAmount = 0;

	onopen: ((event: any) => void) | null = null;
	onmessage: ((event: any) => void) | null = null;
	onclose: ((event: any) => void) | null = null;
	onerror: ((event: any) => void) | null = null;

	private eventListeners = new Map<string, Set<(...args: any[]) => void>>();
	private nodeListeners = new Map<string, Set<(...args: any[]) => void>>();
	private writer: WritableStreamDefaultWriter<Uint8Array>;
	private pendingWrites: Uint8Array[] | null = [];

	constructor(url: string, onEmail: (message: CaughtMessage) => void) {
		this.url = url;

		const [client, server] = makeLoopbackPair();
		void new SmtpSink(server, onEmail).start();
		this.writer = client.writable.getWriter();

		this.emitOpen();
		client.readable
			.pipeTo(
				new WritableStream({
					write: (chunk) => this.emitMessage(chunk),
				})
			)
			.finally(() => {
				if (this.readyState !== this.CLOSED) this.emitClose();
			});
	}

	addEventListener(eventName: string, callback: (...args: any[]) => void) {
		this.addListener(this.eventListeners, eventName, callback);
	}

	removeEventListener(eventName: string, callback: (...args: any[]) => void) {
		this.eventListeners.get(eventName)?.delete(callback);
	}

	on(eventName: string, callback: (...args: any[]) => void) {
		this.addListener(this.nodeListeners, eventName, callback);
	}

	once(eventName: string, callback: (...args: any[]) => void) {
		const wrapped = (...args: any[]) => {
			this.removeListener(eventName, wrapped);
			callback(...args);
		};
		this.on(eventName, wrapped);
	}

	removeListener(eventName: string, callback: (...args: any[]) => void) {
		this.nodeListeners.get(eventName)?.delete(callback);
	}

	send(data: ArrayBuffer | Uint8Array | string) {
		// WebSocket send(string) receives a complete JS string, not partial UTF-8 bytes.
		// Binary SMTP chunks stay as bytes; SmtpSink's streaming decoder handles split
		// multibyte sequences across writes, so TextEncoderStream is unnecessary here.
		const bytes =
			typeof data === 'string'
				? new TextEncoder().encode(data)
				: data instanceof ArrayBuffer
					? new Uint8Array(data)
					: data;

		if (this.readyState === this.CONNECTING) {
			this.pendingWrites!.push(bytes);
			return;
		}
		if (this.readyState !== this.OPEN) {
			this.emitError(
				new Error(
					`SmtpSinkWebSocket: send() called in state ${this.readyState}`
				)
			);
			return;
		}
		this.writeToStream(bytes);
	}

	close() {
		if (
			this.readyState === this.CLOSING ||
			this.readyState === this.CLOSED
		) {
			return;
		}
		this.readyState = this.CLOSING;
		void this.writer.close();
	}

	private addListener(
		listeners: Map<string, Set<(...args: any[]) => void>>,
		eventName: string,
		callback: (...args: any[]) => void
	) {
		let callbacks = listeners.get(eventName);
		if (!callbacks) {
			callbacks = new Set();
			listeners.set(eventName, callbacks);
		}
		callbacks.add(callback);
	}

	private emitOpen() {
		this.readyState = this.OPEN;
		this.onopen?.({});
		this.emitBrowserEvent('open', {});
		this.emitNodeEvent('open', {});
		const buffered = this.pendingWrites;
		this.pendingWrites = null;
		if (buffered) {
			for (const bytes of buffered) {
				this.writeToStream(bytes);
			}
		}
	}

	private emitMessage(data: Uint8Array | ArrayBuffer | string) {
		const event = { data };
		this.onmessage?.(event);
		this.emitBrowserEvent('message', event);
		this.emitNodeEvent('message', data, typeof data !== 'string');
	}

	private emitClose() {
		this.readyState = this.CLOSED;
		this.onclose?.({});
		this.emitBrowserEvent('close', {});
		this.emitNodeEvent('close', {});
	}

	private emitError(error: any) {
		this.onerror?.(error);
		this.emitBrowserEvent('error', error);
		this.emitNodeEvent('error', error);
	}

	private emitBrowserEvent(eventName: string, event: any) {
		const callbacks = this.eventListeners.get(eventName);
		if (!callbacks) return;
		for (const callback of callbacks) {
			callback(event);
		}
	}

	private emitNodeEvent(eventName: string, ...args: any[]) {
		const callbacks = this.nodeListeners.get(eventName);
		if (!callbacks) return;
		for (const callback of callbacks) {
			callback(...args);
		}
	}

	private writeToStream(bytes: Uint8Array) {
		void this.writer.write(bytes);
	}
}
