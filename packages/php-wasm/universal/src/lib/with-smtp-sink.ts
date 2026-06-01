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
 * Captures outbound email from PHP via two interception points:
 *   1. `spawnProcess` — catches `mail()` calls that shell out to sendmail.
 *   2. `websocket.decorator` — catches TCP connections whose requested
 *      destination port matches `options.smtpPort` and routes them through
 *      an in-process SmtpSink.
 *
 * This uses the same WebSocket URL that the networking bridge would normally
 * hand to tcp-over-fetch or the Node TCP proxy. The query parameter is called
 * `port` because it is part of that internal bridge URL, but its value is the
 * TCP destination port that PHP tried to reach.
 *
 * Merges into the provided `emscriptenOptions`, chaining the websocket
 * decorator and using any existing `spawnProcess` as a fallback for
 * non-sendmail commands.
 *
 * Works in both Web and Node runtimes since both hooks are part of the
 * shared EmscriptenOptions surface.
 */
export function withSMTPSink(
	{ smtpPort, onEmail }: WithSmtpSinkOptions,
	emscriptenOptions: EmscriptenOptions = {}
): EmscriptenOptions {
	// TODO: Provide a way for the Playground website to read received messages.
	const previousWs = emscriptenOptions['websocket'] || {};
	const previousDecorator = previousWs.decorator as
		| ((Base: any) => any)
		| undefined;

	const smtpDecorator = (BaseWebSocketConstructor: any) => {
		return class SMTPDecoratedWebSocket extends BaseWebSocketConstructor {
			constructor(url: string, wsOptions?: any) {
				let requestedTcpDestinationPort = -1;
				try {
					const websocketUrl = new URL(url);
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

				super(url, wsOptions);
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
			...previousWs,
			decorator: (Base: any) => {
				const AfterPrev = previousDecorator
					? previousDecorator(Base)
					: Base;
				return smtpDecorator(AfterPrev);
			},
		},
	};
}
