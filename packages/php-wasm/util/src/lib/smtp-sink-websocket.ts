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

		// Defer so Emscripten can register handlers after construction.
		queueMicrotask(() => {
			if (this.readyState !== this.CONNECTING) return;
			this.emitOpen();
			client.readable
				.pipeTo(
					new WritableStream({
						write: (chunk) => this.emitMessage(chunk),
					})
				)
				// pipeTo() rejects if the readable side errors during
				// teardown (e.g. emitMessage throws while the consumer is
				// already tearing down). We still want the .finally()
				// below to run and emit close().
				.catch(() => {})
				.finally(() => {
					if (this.readyState !== this.CLOSED) this.emitClose();
				});
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
		// Closing the writer signals end-of-input to the sink. The sink
		// will flush any pending replies and then close its side, which
		// causes pipeTo above to finalize and emit `close`.
		// writer.close() rejects if the sink already finalized the
		// loopback (e.g. the peer hit QUIT first and the SmtpSink side
		// closed its writable). Benign during normal shutdown.
		this.writer.close().catch(() => {});
	}
}
