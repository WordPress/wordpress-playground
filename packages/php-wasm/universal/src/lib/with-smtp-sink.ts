import type { EmscriptenOptions } from './load-php-runtime';
import {
	SmtpSinkWebSocket,
	createSendmailSpawnHandler,
	type CaughtMessage,
} from '@php-wasm/util';

export type WithSmtpSinkOptions = {
	/**
	 * TCP destination port to intercept as SMTP traffic.
	 *
	 * Emscripten passes each socket destination to `websocket.url(host, port)`.
	 * The web and Node networking adapters encode that destination as the
	 * WebSocket URL query parameter named `port`. This option is matched
	 * against that encoded TCP destination port.
	 */
	port: number;
	onEmail: (message: CaughtMessage) => void;
};

/**
 * Captures outbound email from PHP via two interception points:
 *   1. `spawnProcess` — catches `mail()` calls that shell out to sendmail.
 *   2. `websocket.decorator` — catches TCP connections whose requested
 *      destination port matches `options.port` and routes them through an
 *      in-process SmtpSink.
 *
 * The WebSocket URL query parameter is still called `port` for compatibility
 * with Emscripten's networking bridge. It is the TCP destination port that PHP
 * tried to reach, not the listening port of any WebSocket server.
 *
 * Merges into the provided `emscriptenOptions`, chaining the websocket
 * decorator and using any existing `spawnProcess` as a fallback for
 * non-sendmail commands.
 *
 * Works in both Web and Node runtimes since both hooks are part of the
 * shared EmscriptenOptions surface.
 */
export function withSMTPSink(
	{ port, onEmail }: WithSmtpSinkOptions,
	emscriptenOptions: EmscriptenOptions = {}
): EmscriptenOptions {
	const smtpSinkTargetPort = port;
	// TODO: Provide a way for the Playground website to read received messages.
	const prevWs = emscriptenOptions['websocket'] || {};
	const prevDecorator = prevWs.decorator as ((Base: any) => any) | undefined;

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

				if (requestedTcpDestinationPort === smtpSinkTargetPort) {
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
			...prevWs,
			decorator: (Base: any) => {
				const AfterPrev = prevDecorator ? prevDecorator(Base) : Base;
				return smtpDecorator(AfterPrev);
			},
		},
	};
}
