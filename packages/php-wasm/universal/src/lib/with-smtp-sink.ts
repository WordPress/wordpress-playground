import type { EmscriptenOptions } from './load-php-runtime';
import { SmtpSink, makeLoopbackPair, type CaughtMessage } from '@php-wasm/util';

export type WithSmtpSinkOptions = {
	port: number;
	onEmail: (message: CaughtMessage) => void;
};

/**
 * Intercepts TCP connections initiated by the Emscripten runtime that target a specific port
 * and routes them through an in-process SMTP sink. Works in both Web and Node runtimes because
 * it composes the `websocket.decorator` hook used by networking layers.
 */
export function withSMTPSink({
	port,
	onEmail,
}: WithSmtpSinkOptions): EmscriptenOptions {
	return {
		websocket: {
			decorator: (BaseWebSocketConstructor: any) => {
				return class SMTPDecoratedWebSocket extends BaseWebSocketConstructor {
					private __smtpIntercept = false;
					private __smtpWriter?: WritableStreamDefaultWriter<Uint8Array>;
					private __smtpReaderAbort?: () => void;
					private __smtpClosed = false;

					constructor(url: string, wsOptions?: any) {
						// Determine requested remote port from the query string.
						let targetPort = -1;
						try {
							const u = new URL(url);
							targetPort = parseInt(
								u.searchParams.get('port') || '-1',
								10
							);
						} catch {
							// Ignore URL parse errors
						}

						const isIntercept = targetPort === port;
						// super(...) must be a root-level statement in derived classes
						super(url, wsOptions);
						this.__smtpIntercept = isIntercept;
						if (!isIntercept) {
							return;
						}

						// Build a loopback duplex and start the SMTP sink server.
						const [duplexClient, duplexServer] = makeLoopbackPair();
						const sink = new SmtpSink(duplexServer, onEmail);
						void sink.start();

						// Writer to send client bytes to the sink
						this.__smtpWriter = duplexClient.writable.getWriter();

						// Pump sink responses back to the websocket consumer
						const reader = duplexClient.readable.getReader();
						let aborted = false;
						this.__smtpReaderAbort = () => {
							aborted = true;
							try {
								reader.releaseLock();
							} catch {
								// Ignore release errors
							}
						};
						(async () => {
							try {
								while (!aborted) {
									const { done, value } = await reader.read();
									if (value) {
										// Mirror TCPOverFetchWebsocket's shape: { data: Uint8Array }
										(this as any).onmessage?.({
											data: value,
										});
									}
									if (done) break;
								}
							} finally {
								if (!this.__smtpClosed) {
									(this as any).onclose?.({});
									this.__smtpClosed = true;
								}
							}
						})();

						// Signal open immediately to match WebSocket semantics
						(this as any).onopen?.({});
					}

					// Override send/close to talk to the in-process SMTP server
					send(data: ArrayBuffer | Uint8Array | string) {
						if (!this.__smtpIntercept)
							return super.send(data as any);
						if (!this.__smtpWriter) return;
						let bytes: Uint8Array;
						if (typeof data === 'string') {
							bytes = new TextEncoder().encode(data);
						} else if (data instanceof ArrayBuffer) {
							bytes = new Uint8Array(data);
						} else {
							bytes = data;
						}
						void this.__smtpWriter.write(bytes);
					}

					close(code?: number, reason?: string) {
						if (!this.__smtpIntercept)
							return super.close(code as any, reason as any);
						if (this.__smtpClosed) return;
						this.__smtpClosed = true;
						try {
							this.__smtpReaderAbort?.();
							this.__smtpWriter?.close();
						} catch {
							// Ignore cleanup errors
						}
						(this as any).onclose?.({});
					}
				};
			},
		},
	};
}
