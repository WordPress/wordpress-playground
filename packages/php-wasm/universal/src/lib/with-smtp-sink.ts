import type { EmscriptenOptions } from './load-php-runtime';
import {
	SmtpSinkWebSocket,
	createSendmailSpawnHandler,
	type CaughtMessage,
} from '@php-wasm/util';

export type WithSmtpSinkOptions = {
	/**
	 * The TCP destination port PHP connects to for SMTP (e.g. 25). Connections
	 * to this port are intercepted and routed to the in-process SMTP sink
	 * instead of going out over the network.
	 */
	smtpPort: number;
	/**
	 * Callback invoked with each captured email message.
	 */
	onEmail: (message: CaughtMessage) => void;
};

/**
 * Adds an in-process SMTP sink to Emscripten options.
 *
 * Use this when a PHP runtime should capture outgoing mail instead of sending
 * it. Messages are reported through `onEmail` for both `mail()` calls that
 * invoke sendmail and SMTP socket connections whose TCP destination port
 * matches `smtpPort`.
 *
 * Existing `spawnProcess` and `websocket.decorator` handlers are preserved for
 * non-sendmail commands and non-SMTP WebSocket connections.
 */
export function withSMTPSink(
	{ smtpPort, onEmail }: WithSmtpSinkOptions,
	emscriptenOptions: EmscriptenOptions = {}
): EmscriptenOptions {
	// TODO: Provide a way for the Playground website to read received messages.
	const previousWebSocketOptions = emscriptenOptions['websocket'] || {};
	const previousDecorator = previousWebSocketOptions.decorator as
		| ((Base: any) => any)
		| undefined;

	const smtpDecorator = (BaseWebSocketConstructor: any) => {
		return class SMTPDecoratedWebSocket extends BaseWebSocketConstructor {
			constructor(url: string, webSocketOptions?: any) {
				let requestedTcpDestinationPort = -1;
				try {
					const websocketUrl = new URL(url);
					// Runtime URL factories encode PHP's TCP destination port
					// in the WebSocket URL so decorators can route it. See
					// `@php-wasm/web`'s `tcp-over-fetch-websocket.ts` and
					// `@php-wasm/node`'s `networking/with-networking.ts`.
					requestedTcpDestinationPort = parseInt(
						websocketUrl.searchParams.get('port') || '-1',
						10
					);
				} catch {
					// Ignore URL parse errors
				}

				if (requestedTcpDestinationPort === smtpPort) {
					// Returning an object from a constructor
					// bypasses `this`, avoiding a super() call
					// that would open a real connection to the
					// SMTP port.
					return new SmtpSinkWebSocket(url, onEmail) as any;
				}

				super(url, webSocketOptions);
			}
		};
	};

	return {
		...emscriptenOptions,
		spawnProcess: createSendmailSpawnHandler(
			onEmail,
			emscriptenOptions['spawnProcess']
		),
		websocket: {
			...previousWebSocketOptions,
			decorator: (BaseWebSocketConstructor: any) => {
				const WebSocketConstructorWithPreviousDecorator =
					previousDecorator
						? previousDecorator(BaseWebSocketConstructor)
						: BaseWebSocketConstructor;
				return smtpDecorator(WebSocketConstructorWithPreviousDecorator);
			},
		},
	};
}
