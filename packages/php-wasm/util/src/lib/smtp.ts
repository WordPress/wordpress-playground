import {
	decodeBase64ToString,
	decodeBase64ToUint8Array,
	encodeStringAsBase64,
} from './base64';

/**
 * A pair of byte streams representing one endpoint of a bidirectional
 * connection.
 *
 * Data flow is intentionally from the endpoint owner's point of view:
 *
 * - bytes read from `readable` were written by the peer
 * - bytes written to `writable` become readable by the peer
 *
 * `makeLoopbackPair()` returns two connected endpoints with opposite flow.
 */
export type ByteDuplex = {
	readable: ReadableStream<Uint8Array>;
	writable: WritableStream<Uint8Array>;
};

/**
 * Message captured by `SmtpSink` after a complete SMTP DATA transaction.
 */
export type CaughtMessage = {
	receivedAt: string;
	from: string;
	to: string;
	subject: string;
	headers: Record<string, string>;
	text?: string;
	raw: string;
	rawSize: number;
};

/**
 * SASL authentication mechanisms implemented by this test SMTP sink.
 */
export type SaslMechanism = 'PLAIN' | 'LOGIN';

// Server identifier used in the 220 greeting and as the Domain token in the
// EHLO/HELO 250 response. RFC 5321 §4.1.1.1 requires that token to be a Domain:
// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.1
//
// Use a stable Domain token for test-only SMTP sessions. It is emitted in the
// 220/250 greeting only; this sink still runs over an in-process loopback
// duplex and does not provide DNS or TLS identity.
const SERVER_NAME = 'playground.wordpress.net';

/**
 * Validates credentials provided through SMTP AUTH.
 */
export type AuthValidator = (
	mechanism: SaslMechanism,
	credentials: { username: string; password: string }
) => boolean | Promise<boolean>;

/**
 * Configuration for `SmtpSink`.
 */
export type SmtpSinkOptions = {
	/**
	 * Maximum accepted message size in octets. Advertised as the RFC 1870
	 * SIZE fixed maximum, not as the current message's actual size.
	 *
	 * https://www.rfc-editor.org/rfc/rfc1870.html#section-3
	 */
	maxSize?: number;
	auth?: {
		/** SASL mechanisms to offer. */
		mechanisms?: SaslMechanism[];
		/** Whether to show AUTH in the EHLO extension list. */
		advertise?: boolean;
		/** Whether MAIL/RCPT require successful AUTH first. */
		requireAuth?: boolean;
		/** Credential validator. The default accepts any credentials. */
		validator?: AuthValidator;
	};
};

/**
 * SMTP server sink that receives emails and invokes a callback for
 * each fully-received message.
 */
export class SmtpSink {
	private encoder = new TextEncoder();
	private decoder = new TextDecoder();
	private lineBuffer = '';
	private dataMode = false;
	private dataLines: string[] = [];
	private dataBytes = 0;
	private mailFrom: string | null = null;
	private recipientPaths: string[] = [];
	private writer: WritableStreamDefaultWriter<Uint8Array>;
	private reader: ReadableStreamDefaultReader<Uint8Array>;
	private closed = false;
	private readonly maxSize: number;

	// Commands may trigger async AUTH validators. Queue handlers so SMTP replies
	// are written in the same order as the CRLF-terminated commands arrived.
	private writeQueue: Promise<void> = Promise.resolve();

	// AUTH policy
	private authAdvertise: boolean;
	private authMechanisms: SaslMechanism[];
	private authRequire: boolean;
	private authValidator: AuthValidator;
	private authenticated = false;
	private authPending = false;
	private authState:
		| { mechanism: 'PLAIN'; stage: 'waitInitial' }
		| {
				mechanism: 'LOGIN';
				stage: 'username' | 'password';
				username?: string;
		  }
		| null = null;

	private onEmail: (message: CaughtMessage) => void;

	constructor(
		duplex: ByteDuplex,
		onEmail: (message: CaughtMessage) => void,
		options: SmtpSinkOptions = {}
	) {
		this.onEmail = onEmail;
		this.writer = duplex.writable.getWriter();
		this.reader = duplex.readable.getReader();
		this.maxSize = options.maxSize ?? 10 * 1024 * 1024;

		this.authMechanisms = options.auth?.mechanisms ?? [];
		this.authAdvertise =
			options.auth?.advertise ?? this.authMechanisms.length > 0;
		this.authRequire = options.auth?.requireAuth ?? false;
		this.authValidator = options.auth?.validator ?? (async () => true);
	}

	/**
	 * Starts reading SMTP commands from the duplex until QUIT, stream close,
	 * or protocol rejection closes the sink.
	 */
	async start(): Promise<void> {
		// RFC 5321 §4.3.2: the server sends 220 before accepting commands.
		// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.3.2
		await this.reply(220, `${SERVER_NAME} ESMTP ready`);
		while (true) {
			const readResult = await this.reader.read();
			if (readResult.done) break;
			this.consumeChunk(readResult.value);
			if (this.closed) break;
		}
		// Wait for all enqueued handlers to finish before closing
		// the writer. When the client closes the connection, the
		// reader gets done immediately, but enqueued handlers
		// (like handleDataLine(".") which delivers the email) may
		// still be pending in the promise chain.
		await this.writeQueue;
		await this.close();
	}

	private async close(): Promise<void> {
		if (this.closed) return;
		this.closed = true;
		await this.writer.close();
	}

	private consumeChunk(chunk: Uint8Array) {
		const text = this.decoder.decode(chunk, { stream: true });
		this.lineBuffer += text;

		while (true) {
			// SMTP is line-oriented and commands/data lines are terminated with
			// CRLF, not bare LF:
			// https://www.rfc-editor.org/rfc/rfc5321.html#section-2.3.8
			const crlfIndex = this.lineBuffer.indexOf('\r\n');
			if (crlfIndex < 0) break;
			const line = this.lineBuffer.slice(0, crlfIndex);
			this.lineBuffer = this.lineBuffer.slice(crlfIndex + 2);

			this.queueHandler(async () => {
				if (this.dataMode) {
					await this.handleDataLine(line);
				} else if (this.authPending) {
					await this.handleAuthLine(line);
				} else {
					await this.handleCommand(line);
				}
			});
			if (this.closed) return;
		}

		// RFC 5321 §4.5.3.1.4: command lines (incl. CRLF) ≤ 512
		// octets. §4.5.3.1.6: text lines (incl. CRLF) ≤ 1000 octets.
		// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.5.3.1.4
		// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.5.3.1.6
		// DATA mode uses the 1000-octet text-line limit. Command mode, including
		// AUTH continuation responses, uses the 512-octet command-line limit.
		// If the un-terminated tail of lineBuffer grows past that limit, the
		// peer is malformed (or hostile); refuse it and drop the session rather
		// than letting lineBuffer grow without bound.
		const maxLineLen = this.dataMode ? 1000 : 512;
		if (this.lineBuffer.length > maxLineLen) {
			this.lineBuffer = '';
			this.queueHandler(async () => {
				await this.reply(500, 'line too long');
				await this.close();
			});
		}
	}

	private queueHandler(handler: () => Promise<void>) {
		this.writeQueue = this.writeQueue.then(handler);
	}

	private async handleCommand(rawLine: string) {
		const line = rawLine.trimEnd();
		// SMTP command lines use protocol ABNF, not shell quoting. Splitting at
		// the first space preserves the rest for command-specific RFC parsing.
		const commandSeparator = line.indexOf(' ');
		const command = (
			commandSeparator < 0 ? line : line.slice(0, commandSeparator)
		).toUpperCase();
		const commandArgument =
			commandSeparator < 0 ? '' : line.slice(commandSeparator + 1);

		switch (command) {
			case 'EHLO':
			case 'HELO': {
				// RFC 5321 §4.1.1.1 ABNF: both `helo` and `ehlo`
				// require a Domain (or address-literal for EHLO)
				// argument; an empty argument is a syntax error.
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.1
				if (!commandArgument.trim()) {
					await this.reply(501, `syntax: ${command} <domain>`);
					break;
				}
				// RFC 5321 §4.1.4: a successful EHLO/HELO issued mid-
				// session MUST clear all buffers and reset state exactly
				// as RSET would. Auth state is preserved (RFC 4954 §4).
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.4
				this.resetEnvelope();
				if (command === 'HELO') {
					// RFC 5321 §4.1.1.1 ABNF:
					//   ehlo-ok-rsp = "250" SP Domain [ SP ehlo-greet ]
					// HELO uses the same single-line form. The first
					// token after the reply code MUST be the server's
					// Domain, optionally followed by free-form text.
					await this.reply(
						250,
						`${SERVER_NAME} Hello ${commandArgument}`
					);
					break;
				}
				// RFC 5321 §4.1.1.1 ABNF for the multi-line response:
				//   "250-" Domain [ SP ehlo-greet ] CRLF
				//   *( "250-" ehlo-line CRLF )
				//   "250" SP ehlo-line CRLF
				// The first line therefore starts with the server's
				// Domain, never with free-form text.
				const extensions: string[] = [];
				if (this.authAdvertise && this.authMechanisms.length) {
					const authMechanismList = this.authMechanisms.join(' ');
					extensions.push(
						`AUTH ${authMechanismList}`,
						`AUTH=${authMechanismList}`
					);
				}
				// RFC 1870 §3: SIZE parameter is the maximum message size the
				// server will accept, not the size of a message in progress.
				// https://www.rfc-editor.org/rfc/rfc1870.html#section-3
				extensions.push(`SIZE ${this.maxSize}`, 'PIPELINING');
				await this.replyMulti(250, [
					`${SERVER_NAME} Hello ${commandArgument}`,
					...extensions,
				]);
				break;
			}

			case 'STARTTLS': {
				// The loopback duplex carries no real network traffic, so
				// there is nothing to encrypt. STARTTLS is never advertised
				// in EHLO and is always refused with 502 "Command not
				// implemented" if a client tries it anyway:
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.2.4
				// Clients with strict STARTTLS settings, such as PHPMailer
				// SMTPSecure=ENCRYPTION_STARTTLS, must be configured for plain
				// SMTP when talking to this sink. Opportunistic STARTTLS
				// clients should not try STARTTLS because EHLO omits it.
				// RFC 3207 §4 defines the STARTTLS command:
				// https://www.rfc-editor.org/rfc/rfc3207.html#section-4
				await this.reply(502, 'Command not implemented');
				break;
			}

			case 'AUTH': {
				// RFC 4954 §4 extends SMTP with the AUTH command.
				// https://www.rfc-editor.org/rfc/rfc4954.html#section-4
				const [mechanismRaw, initialResponseRaw] =
					commandArgument.split(/\s+/, 2);
				const mechanism = (
					mechanismRaw || ''
				).toUpperCase() as SaslMechanism;

				if (!mechanism) {
					await this.reply(
						501,
						'syntax: AUTH mechanism [initial-response]'
					);
					break;
				}
				if (this.authenticated) {
					await this.reply(503, 'already authenticated');
					break;
				}

				if (!this.authMechanisms.includes(mechanism)) {
					await this.reply(504, 'Unrecognized authentication type');
					break;
				}

				if (mechanism === 'PLAIN') {
					const initialResponse =
						getAuthInitialResponse(initialResponseRaw);
					if (initialResponse == null) {
						this.authPending = true;
						this.authState = {
							mechanism: 'PLAIN',
							stage: 'waitInitial',
						};
						await this.reply(334, ''); // empty challenge
					} else {
						const isValid =
							await this.handleAuthPlain(initialResponse);
						await this.finishAuth(isValid);
					}
					break;
				}

				if (mechanism === 'LOGIN') {
					const initialResponse =
						getAuthInitialResponse(initialResponseRaw);
					if (initialResponse != null) {
						// The initial response is the username for AUTH LOGIN.
						const username = decodeBase64Text(initialResponse);
						this.authPending = true;
						this.authState = {
							mechanism: 'LOGIN',
							stage: 'password',
							username,
						};
						await this.reply(334, encodeBase64Text('Password:'));
					} else {
						this.authPending = true;
						this.authState = {
							mechanism: 'LOGIN',
							stage: 'username',
						};
						await this.reply(334, encodeBase64Text('Username:'));
					}
					break;
				}
				break;
			}

			case 'MAIL': {
				if (this.authRequire && !this.authenticated) {
					await this.reply(530, 'Authentication required');
					break;
				}
				// RFC 5321 §3.3 + §4.1.1.2: the syntax is exactly
				// `MAIL FROM:<reverse-path>`. §3.3 explicitly forbids
				// "spaces on either side of the colon", and the
				// reverse-path MUST be enclosed in angle brackets (or
				// be the literal `<>` for the null reverse-path,
				// §4.5.5).
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-3.3
				const path = parseEnvelopeArg(commandArgument, 'FROM');
				if (path === null) {
					await this.reply(501, 'syntax: MAIL FROM:<addr>');
					break;
				}
				this.mailFrom = path;
				this.recipientPaths = [];
				await this.reply(250, 'OK');
				break;
			}

			case 'RCPT': {
				if (this.authRequire && !this.authenticated) {
					await this.reply(530, 'Authentication required');
					break;
				}
				// RFC 5321 §3.3 + §4.1.1.3: the syntax is exactly
				// `RCPT TO:<forward-path>`. Same no-space, mandatory-
				// brackets rule as MAIL FROM.
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.3
				const path = parseEnvelopeArg(commandArgument, 'TO');
				if (path === null) {
					await this.reply(501, 'syntax: RCPT TO:<addr>');
					break;
				}
				// Explicit null check (not falsy): an empty string is a
				// valid null reverse-path (`MAIL FROM:<>`, RFC 5321
				// §4.5.5) and must not gate RCPT.
				if (this.mailFrom === null) {
					await this.reply(503, 'need MAIL FROM first');
					break;
				}
				this.recipientPaths.push(path);
				await this.reply(250, 'Accepted');
				break;
			}

			case 'DATA': {
				// RFC 5321 §3.3: DATA begins mail content after a valid
				// MAIL/RCPT envelope and is terminated by <CRLF>.<CRLF>.
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-3.3
				if (
					this.mailFrom === null ||
					this.recipientPaths.length === 0
				) {
					await this.reply(503, 'need MAIL/RCPT first');
					break;
				}
				await this.reply(354, 'End data with <CR><LF>.<CR><LF>');
				this.dataMode = true;
				this.dataLines = [];
				this.dataBytes = 0;
				break;
			}

			case 'RSET':
				// RFC 5321 §4.1.1.5: abort the current mail transaction.
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.5
				this.resetEnvelope();
				await this.reply(250, 'OK');
				break;

			case 'NOOP':
				// RFC 5321 §4.1.1.9: NOOP has no effect except returning OK.
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.9
				await this.reply(250, 'OK');
				break;

			case 'VRFY':
				// RFC 5321 §3.5.3: 252 means we cannot verify, but will accept mail.
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-3.5.3
				await this.reply(
					252,
					'Cannot VRFY user, but will accept message'
				);
				break;

			case 'QUIT':
				// RFC 5321 §4.1.1.10: successful QUIT returns 221, then closes.
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.10
				await this.reply(221, 'Bye');
				await this.close();
				break;

			case 'EXPN':
			case 'HELP':
			case 'TURN':
				// RFC 5321 §4.2.4: 502 means recognized but not implemented.
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.2.4
				await this.reply(502, 'Command not implemented');
				break;

			default:
				// RFC 5321 §4.2.4: 500 means the command was not recognized.
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.2.4
				await this.reply(500, 'command not recognized');
				break;
		}
	}

	private async handleDataLine(line: string) {
		if (line === '.') {
			this.dataMode = false;
			if (this.dataBytes > this.maxSize) {
				// RFC 1870 §6.3: when the size overflow is discovered
				// mid-stream, the 552 reply must come *after* the
				// end-of-data marker. Anything else desyncs the session.
				// https://www.rfc-editor.org/rfc/rfc1870.html#section-6.3
				await this.reply(552, 'message size exceeds fixed limit');
				this.resetEnvelope();
				return;
			}
			const raw = this.dataLines.join('\r\n') + '\r\n';
			const { headers, subject, text, from, to } = parseMessage(
				raw,
				this.mailFrom ?? '',
				this.recipientPaths
			);
			const message: CaughtMessage = {
				receivedAt: new Date().toISOString(),
				from,
				to,
				subject,
				headers,
				text,
				raw,
				rawSize: this.dataBytes,
			};

			this.onEmail(message);

			await this.reply(250, 'OK');
			this.resetEnvelope();
			return;
		}

		const actual = line.startsWith('..') ? line.slice(1) : line;
		// RFC 5321 §4.5.2 transparency: clients dot-stuff body lines that
		// start with "." so they cannot be mistaken for end-of-data.
		// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.5.2
		this.dataBytes += this.encoder.encode(actual).byteLength + 2;
		if (this.dataBytes <= this.maxSize) {
			this.dataLines.push(actual);
		}
	}

	private async handleAuthLine(line: string) {
		if (!this.authState) {
			this.authPending = false;
			return;
		}
		if (line === '*') {
			this.authPending = false;
			this.authState = null;
			await this.reply(501, 'Authentication canceled');
			return;
		}

		if (this.authState.mechanism === 'PLAIN') {
			const isValid = await this.handleAuthPlain(line.trim());
			await this.finishAuth(isValid);
			return;
		}

		if (this.authState.mechanism === 'LOGIN') {
			if (this.authState.stage === 'username') {
				const username = decodeBase64Text(line.trim());
				this.authState = {
					mechanism: 'LOGIN',
					stage: 'password',
					username,
				};
				await this.reply(334, encodeBase64Text('Password:'));
				return;
			}
			if (this.authState.stage === 'password') {
				const password = decodeBase64Text(line.trim());
				const isValid = await this.authValidator('LOGIN', {
					username: this.authState.username || '',
					password,
				});
				await this.finishAuth(isValid);
				return;
			}
		}
	}

	private async handleAuthPlain(initialBase64: string): Promise<boolean> {
		let decoded = '';
		try {
			decoded = decodeBase64ToString(initialBase64);
		} catch {
			return false;
		}
		// formats: authzid\0authcid\0passwd  OR  \0authcid\0passwd
		const parts = decoded.split('\u0000');
		let username = '';
		let password = '';
		if (parts.length >= 3) {
			username = parts[1] || '';
			password = parts[2] || '';
		} else if (parts.length === 2) {
			username = parts[0] || '';
			password = parts[1] || '';
		} else {
			return false;
		}
		return await this.authValidator('PLAIN', { username, password });
	}

	private async finishAuth(isValid: boolean) {
		this.authPending = false;
		this.authState = null;
		if (isValid) {
			this.authenticated = true;
			await this.reply(235, 'Authentication succeeded');
		} else {
			await this.reply(535, 'Authentication credentials invalid');
		}
	}

	private resetEnvelope() {
		this.mailFrom = null;
		this.recipientPaths = [];
		this.dataMode = false;
		this.dataLines = [];
		this.dataBytes = 0;
	}

	private async reply(code: number, text: string) {
		// RFC 5321 §4.2: a single-line reply is "<code> <text><CRLF>".
		// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.2
		await this.writer.write(this.encoder.encode(`${code} ${text}\r\n`));
	}
	private async replyMulti(code: number, lines: string[]) {
		// RFC 5321 §4.2: multi-line replies use "-" until the final SP line.
		// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.2
		for (let i = 0; i < lines.length - 1; i++) {
			await this.writer.write(
				this.encoder.encode(`${code}-${lines[i]}\r\n`)
			);
		}
		await this.writer.write(
			this.encoder.encode(`${code} ${lines[lines.length - 1]}\r\n`)
		);
	}
}

/**
 * Parses the argument of a MAIL or RCPT command into the envelope
 * path. Returns `null` if the syntax does not match RFC 5321.
 *
 * RFC 5321 §3.3 + §4.1.1.2/3 require:
 *   - the keyword (`FROM` or `TO`) is followed immediately by a
 *     colon, with NO whitespace on either side ("a common source
 *     of errors", §3.3)
 *   - the path is enclosed in angle brackets, or is the literal
 *     `<>` for the null reverse-path (§4.5.5)
 *   - any ESMTP Mail-parameters that follow MUST be separated
 *     from the closing `>` by a single space (RFC 1870, RFC 4954)
 *
 * https://www.rfc-editor.org/rfc/rfc5321.html#section-3.3
 * https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.2
 * https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.3
 * https://www.rfc-editor.org/rfc/rfc5321.html#section-4.5.5
 * https://www.rfc-editor.org/rfc/rfc1870.html#section-5
 * https://www.rfc-editor.org/rfc/rfc4954.html#section-5
 */
export function parseEnvelopeArg(
	commandArgument: string,
	keyword: 'FROM' | 'TO'
): string | null {
	const prefix = `${keyword}:<`;
	if (commandArgument.length < prefix.length + 1) return null;
	if (commandArgument.slice(0, prefix.length).toUpperCase() !== prefix) {
		return null;
	}
	const close = commandArgument.indexOf('>', prefix.length);
	if (close < 0) return null;
	// Anything past the closing bracket must either be empty or
	// begin with a single space introducing ESMTP parameters.
	const tail = commandArgument.slice(close + 1);
	if (tail !== '' && !tail.startsWith(' ')) return null;
	return commandArgument.slice(prefix.length, close);
}

/**
 * Extracts email addresses from an RFC 5322 address list.
 * Handles a mix of "Name <addr>" and bare "addr" entries.
 */
export function extractAddresses(value: string): string[] {
	const addresses: string[] = [];
	for (const part of value.split(',')) {
		const trimmed = part.trim();
		if (!trimmed) continue;
		const angle = trimmed.match(/<([^>]+)>/);
		if (angle) {
			addresses.push(angle[1].trim());
		} else if (trimmed.includes('@')) {
			addresses.push(trimmed);
		}
	}
	return addresses;
}

/**
 * Removes RFC 5322 folded-header line breaks.
 *
 * https://www.rfc-editor.org/rfc/rfc5322.html#section-2.2.3
 */
export function unfoldHeaders(headerBlock: string): string {
	return headerBlock.replace(/\r\n([ \t]+)/g, ' ');
}

/**
 * Splits an RFC 5322 message into header and body sections at the first empty
 * CRLF line.
 *
 * https://www.rfc-editor.org/rfc/rfc5322.html#section-2.1
 */
export function splitHeaderBody(raw: string): {
	headerRaw: string;
	bodyRaw: string;
} {
	const separatorIndex = raw.indexOf('\r\n\r\n');
	if (separatorIndex < 0) return { headerRaw: raw, bodyRaw: '' };
	return {
		headerRaw: raw.slice(0, separatorIndex),
		bodyRaw: raw.slice(separatorIndex + 4),
	};
}

/**
 * Parses unfolded RFC 5322 header fields into a lower-case name/value map.
 */
export function parseHeaderLines(headerRaw: string): Record<string, string> {
	const headers: Record<string, string> = {};
	const unfolded = unfoldHeaders(headerRaw);
	const lines = unfolded.split('\r\n');
	for (const line of lines) {
		const separatorIndex = line.indexOf(':');
		if (separatorIndex <= 0) continue;
		const name = line.slice(0, separatorIndex).toLowerCase();
		const value = line.slice(separatorIndex + 1).trim();
		headers[name] = (headers[name] ? headers[name] + ', ' : '') + value;
	}
	return headers;
}

function decodeRfc2047EncodedWords(headerValue: string): string {
	// RFC 2047 encoded-words may appear next to each other with only linear
	// white space between them; that white space is ignored when decoding.
	// https://www.rfc-editor.org/rfc/rfc2047.html#section-6.2
	const adjacentEncodedWordsCollapsed = headerValue.replace(
		/(=\?[^?]+\?[BbQq]\?[^?]+\?=)[ \t\r\n]+(?==\?[^?]+\?[BbQq]\?[^?]+\?=)/g,
		'$1'
	);
	return adjacentEncodedWordsCollapsed.replace(
		/=\?([^?]+)\?([BbQq])\?([^?]+)\?=/g,
		(encodedWord, charsetRaw, encodingRaw, encodedText) => {
			const charset = String(charsetRaw);
			const encoding = String(encodingRaw).toUpperCase();
			let bytes: Uint8Array;
			try {
				// RFC 2047 encoded-words are 7-bit transfer syntaxes for the
				// original octets in the declared charset. For UTF-16 words,
				// those octets can include NUL and surrogate-pair bytes; only
				// after reconstructing them should TextDecoder decode `charset`.
				// https://www.rfc-editor.org/rfc/rfc2047.html#section-2
				if (encoding === 'B') {
					bytes = decodeBase64ToUint8Array(String(encodedText));
				} else {
					bytes = decodeRfc2047QEncodedWord(String(encodedText));
				}
			} catch {
				return encodedWord;
			}
			return decodeBytes(bytes, charset);
		}
	);
}

function decodeRfc2047QEncodedWord(encodedText: string): Uint8Array {
	// RFC 2047 Q-encoding is byte-oriented. "_" is byte 0x20, and "=XX"
	// injects one raw octet. The byte stream is decoded later using the
	// encoded-word charset, so do not treat these as JS characters yet.
	// https://www.rfc-editor.org/rfc/rfc2047.html#section-4.2
	const binaryText = encodedText
		.replace(/_/g, ' ')
		.replace(/=([0-9A-Fa-f]{2})/g, (_match, hexByte) =>
			String.fromCharCode(parseInt(hexByte, 16))
		);
	return new Uint8Array([...binaryText].map((char) => char.charCodeAt(0)));
}

function decodeBytes(bytes: Uint8Array, charset: string): string {
	const normalizedCharset = charset.toLowerCase();
	const textDecoderEncodingLabel =
		normalizedCharset === 'utf8' ? 'utf-8' : normalizedCharset;
	try {
		// TextDecoder performs charset decoding and replacement-character
		// handling for malformed byte sequences. Unsupported charset labels
		// fall back to the default UTF-8 decoder below.
		return new TextDecoder(textDecoderEncodingLabel).decode(bytes);
	} catch {
		return new TextDecoder().decode(bytes);
	}
}

function decodeQuotedPrintableToBytes(content: string): Uint8Array {
	const softLineBreaksRemoved = content.replace(/=\r\n/g, '');
	const bytes: number[] = [];
	for (let i = 0; i < softLineBreaksRemoved.length; i++) {
		const char = softLineBreaksRemoved[i];
		if (char === '=' && i + 2 < softLineBreaksRemoved.length) {
			const hexByte = softLineBreaksRemoved.slice(i + 1, i + 3);
			if (/^[0-9A-Fa-f]{2}$/.test(hexByte)) {
				bytes.push(parseInt(hexByte, 16));
				i += 2;
				continue;
			}
		}
		bytes.push(char.charCodeAt(0));
	}
	return new Uint8Array(bytes);
}

function decodeBase64Text(content: string): string {
	return decodeBase64ToString(content);
}

function encodeBase64Text(content: string): string {
	return encodeStringAsBase64(content);
}

function stripQuotes(value: string): string {
	const match = value.match(/^"(.*)"$/);
	return match ? match[1] : value;
}

function getHeaderParameter(headerValue: string, name: string): string | null {
	const parameterPattern = new RegExp(`;\\s*${name}=([^;]+)`, 'i');
	const match = headerValue.match(parameterPattern);
	return match ? stripQuotes(match[1]) : null;
}
function pickTextPlainFromMultipart(
	body: string,
	boundary: string
): { headers: Record<string, string>; content: string } | null {
	// RFC 2046 §5.1 defines multipart boundary delimiter lines.
	// https://www.rfc-editor.org/rfc/rfc2046.html#section-5.1
	const boundaryDelimiter = `--${boundary}`;
	const closingBoundaryDelimiter = `--${boundary}--`;
	const lines = body.split('\r\n');
	let currentPartLines: string[] = [];
	const parts: string[] = [];
	let inPart = false;
	for (const line of lines) {
		if (line === boundaryDelimiter) {
			if (inPart && currentPartLines.length) {
				parts.push(currentPartLines.join('\r\n'));
			}
			inPart = true;
			currentPartLines = [];
		} else if (line === closingBoundaryDelimiter) {
			if (inPart && currentPartLines.length) {
				parts.push(currentPartLines.join('\r\n'));
			}
			inPart = false;
			break;
		} else if (inPart) {
			currentPartLines.push(line);
		}
	}
	if (inPart && currentPartLines.length) {
		parts.push(currentPartLines.join('\r\n'));
	}
	for (const part of parts) {
		const { headerRaw, bodyRaw } = splitHeaderBody(part);
		const partHeaders = parseHeaderLines(headerRaw);
		const contentType = (
			partHeaders['content-type'] || 'text/plain'
		).toLowerCase();
		if (contentType.startsWith('text/plain')) {
			return { headers: partHeaders, content: bodyRaw };
		}
	}
	return null;
}

function decodeBody(
	contentTransferEncoding: string | undefined,
	charset: string | undefined,
	content: string
): string {
	const normalizedContentTransferEncoding = (
		contentTransferEncoding || ''
	).toLowerCase();
	if (
		normalizedContentTransferEncoding !== 'base64' &&
		normalizedContentTransferEncoding !== 'quoted-printable'
	) {
		return content;
	}
	const bytes =
		normalizedContentTransferEncoding === 'base64'
			? decodeBase64ToUint8Array(content)
			: decodeQuotedPrintableToBytes(content);
	return decodeBytes(bytes, charset || 'utf-8');
}

/**
 * Parses the message content received after SMTP DATA into convenient fields.
 *
 * This is intentionally a small RFC 5322/MIME helper for the SMTP sink, not a
 * full mail user-agent parser. It handles the header/body split, folded
 * headers, RFC 2047 encoded words, common text transfer encodings, and the
 * first text/plain part in multipart messages.
 */
export function parseMessage(
	raw: string,
	fallbackFrom: string,
	fallbackRecipients: string[]
): {
	headers: Record<string, string>;
	subject: string;
	text?: string;
	from: string;
	to: string;
} {
	const { headerRaw, bodyRaw } = splitHeaderBody(raw);
	const headers = parseHeaderLines(headerRaw);
	const subject = headers['subject']
		? decodeRfc2047EncodedWords(headers['subject'])
		: '(no subject)';
	const from = headers['from']
		? decodeRfc2047EncodedWords(headers['from'])
		: fallbackFrom;

	const recipientParts: string[] = [];
	for (const headerName of ['to', 'cc', 'bcc']) {
		if (headers[headerName]) {
			recipientParts.push(decodeRfc2047EncodedWords(headers[headerName]));
		}
	}
	const to =
		recipientParts.length > 0
			? recipientParts.join(', ')
			: fallbackRecipients.join(', ');

	let text: string | undefined;
	const contentType = (headers['content-type'] || 'text/plain').toLowerCase();
	if (contentType.startsWith('multipart/')) {
		const boundary = getHeaderParameter(
			headers['content-type'],
			'boundary'
		);
		if (boundary) {
			const part = pickTextPlainFromMultipart(bodyRaw, boundary);
			if (part) {
				const partContentTransferEncoding = (
					part.headers['content-transfer-encoding'] || ''
				).toLowerCase();
				const partCharset =
					getHeaderParameter(
						part.headers['content-type'] || '',
						'charset'
					) || 'utf-8';
				text = decodeBody(
					partContentTransferEncoding,
					partCharset,
					part.content
				);
			}
		}
	} else if (contentType.startsWith('text/plain')) {
		const contentTransferEncoding = (
			headers['content-transfer-encoding'] || ''
		).toLowerCase();
		const charset =
			getHeaderParameter(headers['content-type'] || '', 'charset') ||
			'utf-8';
		text = decodeBody(contentTransferEncoding, charset, bodyRaw);
	} else {
		text = bodyRaw;
	}
	return { headers, subject, text, from, to };
}

/**
 * Creates two connected in-memory `ByteDuplex` endpoints.
 *
 * Bytes written to the first endpoint's `writable` are read from the second
 * endpoint's `readable`, and vice versa.
 */
export function makeLoopbackPair(): [ByteDuplex, ByteDuplex] {
	const firstToSecond = new TransformStream<Uint8Array, Uint8Array>();
	const secondToFirst = new TransformStream<Uint8Array, Uint8Array>();
	const first: ByteDuplex = {
		readable: secondToFirst.readable,
		writable: firstToSecond.writable,
	};
	const second: ByteDuplex = {
		readable: firstToSecond.readable,
		writable: secondToFirst.writable,
	};
	return [first, second];
}

function getAuthInitialResponse(response?: string): string | null {
	if (!response) return null;
	const trimmed = response.trim();
	if (trimmed === '' || trimmed === '=') return null;
	return trimmed;
}
