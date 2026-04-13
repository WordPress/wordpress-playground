import { WebSocketShim } from './websocket-shim';
import { SmtpSink, makeLoopbackPair, type CaughtMessage } from './smtp';

/**
 * A WebSocket-shaped class that pipes outbound bytes through an in-process
 * SmtpSink instead of opening a real network connection. Used to intercept
 * Emscripten's SMTP-bound TCP traffic.
 */
export class SmtpSinkWebSocket extends WebSocketShim {
	private writer: WritableStreamDefaultWriter<Uint8Array>;

	constructor(url: string, onEmail: (message: CaughtMessage) => void) {
		super(url);

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

	override send(data: ArrayBuffer | Uint8Array | string) {
		if (this.readyState !== this.OPEN) return;
		const bytes =
			typeof data === 'string'
				? new TextEncoder().encode(data)
				: data instanceof ArrayBuffer
					? new Uint8Array(data)
					: data;
		void this.writer.write(bytes);
	}

	override close() {
		if (this.readyState >= this.CLOSING) return;
		this.readyState = this.CLOSING;
		void this.writer.close();
	}
}
