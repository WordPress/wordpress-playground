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
 * A non-body MIME part captured from a message: a regular attachment, an
 * inline resource such as a `cid:` image, or a metadata-less binary part.
 */
export type CaughtAttachment = {
	/**
	 * Decoded filename from `Content-Disposition: filename=`, falling back
	 * to `Content-Type: name=`. Absent when neither parameter exists.
	 */
	filename?: string;
	/** Lower-cased media type without parameters, e.g. `application/pdf`. */
	contentType: string;
	/**
	 * Lower-cased `Content-Disposition` type token with parameters stripped,
	 * or `''` when the header is absent or carries no parseable token. RFC
	 * 2183 allows extension tokens (e.g. `x-foo`), so this is deliberately
	 * not restricted to `'attachment' | 'inline'` — the sink preserves what
	 * the sender said.
	 */
	contentDisposition: string;
	/**
	 * `Content-ID` value with one pair of surrounding angle brackets
	 * stripped, so `<logo>` matches `cid:logo` references. Absent when the
	 * header is missing.
	 */
	contentId?: string;
	/** Parsed part headers as a lower-cased name/value map. */
	headers: Record<string, string>;
	/**
	 * Decoded bytes. Survives structured clone (postMessage/comlink) but not
	 * `JSON.stringify` — JSON consumers must base64-encode it themselves.
	 */
	content: Uint8Array;
	/** Decoded byte length, so serialized views can report sizes. */
	size: number;
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
	/**
	 * Decoded text/plain body part. In multipart/alternative messages this is
	 * separate from the richer text/html alternative.
	 */
	text?: string;
	/**
	 * Decoded text/html body part. Mail clients typically render this when
	 * available and fall back to text/plain.
	 */
	html?: string;
	/**
	 * Non-body MIME parts in message order. Empty when the message carries
	 * no attachments.
	 */
	attachments: CaughtAttachment[];
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

// RFC 5321 defines reply *codes* as protocol semantics and reply text as
// human-readable context. Use RFC 5321/1870/4954 text where available, and
// the generic code text where a command-specific phrase is unnecessary.
const SMTP_REPLY_TEXT = {
	serviceReady: `${SERVER_NAME} ESMTP Service Ready`,
	ok: 'OK',
	syntaxError: 'Syntax error in parameters or arguments',
	commandUnrecognized: 'Syntax error, command unrecognized',
	commandNotImplemented: 'Command not implemented',
	badSequence: 'Bad sequence of commands',
	startMailInput: 'Start mail input; end with <CRLF>.<CRLF>',
	cannotVrfyUser:
		'Cannot VRFY user, but will accept message and attempt delivery',
	messageSizeExceeded: 'Message size exceeds fixed maximum message size',
	authSucceeded: '2.7.0 Authentication Succeeded',
	authCredentialsInvalid: '5.7.8 Authentication credentials invalid',
	authRequired: '5.7.0 Authentication required',
	authCanceled: '5.7.0 Authentication canceled',
	authTypeUnrecognized: '5.5.4 Unrecognized authentication type',
} as const;

/**
 * Validates credentials provided through SMTP AUTH.
 */
export type AuthValidator = (
	mechanism: SaslMechanism,
	credentials: { username: string; password: string }
) => boolean | Promise<boolean>;

export const DEFAULT_SMTP_MAX_SIZE = 10 * 1024 * 1024;

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
		this.maxSize = options.maxSize ?? DEFAULT_SMTP_MAX_SIZE;

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
		await this.reply(220, SMTP_REPLY_TEXT.serviceReady);
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
		await Promise.allSettled([this.writer.close(), this.reader.cancel()]);
	}

	private consumeChunk(chunk: Uint8Array) {
		if (this.closed) return;
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
				if (this.closed) return;
				if (
					this.encoder.encode(line).byteLength + 2 >
					this.currentLineLimit()
				) {
					await this.reply(500, SMTP_REPLY_TEXT.commandUnrecognized);
					await this.close();
					return;
				}
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

		// RFC 5321 caps command lines at 512 octets and DATA text lines at
		// 1000 octets, both including CRLF. RFC 4954 allows AUTH responses
		// up to 12288 octets including CRLF.
		// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.5.3.1.4
		// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.5.3.1.6
		// https://www.rfc-editor.org/rfc/rfc4954.html#section-4
		if (
			this.encoder.encode(this.lineBuffer).byteLength + 2 >
			this.currentLineLimit()
		) {
			this.lineBuffer = '';
			this.queueHandler(async () => {
				await this.reply(500, SMTP_REPLY_TEXT.commandUnrecognized);
				await this.close();
			});
		}
	}

	private currentLineLimit(): number {
		if (this.dataMode) return 1000;
		if (this.authPending) return 12288;
		return 512;
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
					await this.reply(501, SMTP_REPLY_TEXT.syntaxError);
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
				// server will accept.
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
				await this.reply(502, SMTP_REPLY_TEXT.commandNotImplemented);
				break;
			}

			case 'AUTH': {
				// RFC 4954 §4 forbids AUTH during an active mail transaction.
				// https://www.rfc-editor.org/rfc/rfc4954.html#section-4
				if (this.mailFrom !== null || this.recipientPaths.length > 0) {
					await this.reply(503, SMTP_REPLY_TEXT.badSequence);
					break;
				}
				// RFC 4954 §4: `AUTH <mechanism> [<initial-response>]`. Match
				// group 1 = mechanism (1-20 of letter/digit/-/_); group 2 =
				// one optional non-whitespace token. base64 is validated on
				// decode below, so we don't check it here. `=` means empty.
				// https://www.rfc-editor.org/rfc/rfc4954.html#section-4
				const authMatch = commandArgument.match(
					/^([A-Za-z0-9_-]{1,20})(?: (\S*))?$/
				);
				if (!authMatch) {
					await this.reply(501, SMTP_REPLY_TEXT.syntaxError);
					break;
				}
				const mechanism = authMatch[1].toUpperCase() as SaslMechanism;
				const arg = authMatch[2];
				const initialResponse =
					arg === undefined ? null : arg === '=' ? '' : arg || null;

				if (this.authenticated) {
					await this.reply(503, SMTP_REPLY_TEXT.badSequence);
					break;
				}

				if (!this.authMechanisms.includes(mechanism)) {
					await this.reply(504, SMTP_REPLY_TEXT.authTypeUnrecognized);
					break;
				}

				if (mechanism === 'PLAIN') {
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
						if (isValid === null) {
							await this.rejectAuthSyntax();
						} else {
							await this.finishAuth(isValid);
						}
					}
					break;
				}

				if (mechanism === 'LOGIN') {
					if (initialResponse != null) {
						// The initial response is the username for AUTH LOGIN.
						let username: string;
						try {
							username = decodeBase64ToString(initialResponse);
						} catch {
							await this.rejectAuthSyntax();
							break;
						}
						this.authPending = true;
						this.authState = {
							mechanism: 'LOGIN',
							stage: 'password',
							username,
						};
						await this.reply(
							334,
							encodeStringAsBase64('Password:')
						);
					} else {
						this.authPending = true;
						this.authState = {
							mechanism: 'LOGIN',
							stage: 'username',
						};
						await this.reply(
							334,
							encodeStringAsBase64('Username:')
						);
					}
					break;
				}
				break;
			}

			case 'MAIL': {
				if (this.authRequire && !this.authenticated) {
					await this.reply(530, SMTP_REPLY_TEXT.authRequired);
					break;
				}
				// RFC 5321 §3.3 + §4.1.1.2: the syntax is exactly
				// `MAIL FROM:<reverse-path>`. §3.3 explicitly forbids
				// "spaces on either side of the colon", and the
				// reverse-path MUST be enclosed in angle brackets (or
				// be the literal `<>` for the null reverse-path,
				// §4.5.5).
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-3.3
				const envelope = parseEnvelopeArg(commandArgument, 'FROM');
				if (envelope === null) {
					await this.reply(501, SMTP_REPLY_TEXT.syntaxError);
					break;
				}
				// RFC 5321 §4.1.1.2: Mail-parameters must match the
				// esmtp-param grammar. Unknown keywords are ignored, but
				// a malformed parameter list is still a syntax error.
				const parameters = parseEsmtpParameters(envelope.parameters);
				if (parameters === null) {
					// The client tried to start a new transaction and
					// failed; do not leave a previous envelope around for
					// DATA to flush.
					this.resetEnvelope();
					await this.reply(501, SMTP_REPLY_TEXT.syntaxError);
					break;
				}
				// RFC 1870 §6.1: the EHLO response advertises a fixed
				// maximum message size, so a MAIL command declaring a
				// larger SIZE is rejected up front with 552 and the
				// transaction never starts — including any transaction
				// left over from a previous MAIL command.
				// https://www.rfc-editor.org/rfc/rfc1870.html#section-6.1
				if ('SIZE' in parameters) {
					const declaredSize = parameters['SIZE'];
					// RFC 1870 §4: size-value ::= 1*20DIGIT.
					// https://www.rfc-editor.org/rfc/rfc1870.html#section-4
					// Use the exact grammar instead of number parsing, which
					// would accept SMTP-invalid forms like `1e2` or `+12`.
					if (!/^[0-9]{1,20}$/.test(declaredSize)) {
						this.resetEnvelope();
						await this.reply(501, SMTP_REPLY_TEXT.syntaxError);
						break;
					}
					if (Number(declaredSize) > this.maxSize) {
						this.resetEnvelope();
						await this.reply(
							552,
							SMTP_REPLY_TEXT.messageSizeExceeded
						);
						break;
					}
				}
				this.mailFrom = envelope.path;
				this.recipientPaths = [];
				await this.reply(250, SMTP_REPLY_TEXT.ok);
				break;
			}

			case 'RCPT': {
				if (this.authRequire && !this.authenticated) {
					await this.reply(530, SMTP_REPLY_TEXT.authRequired);
					break;
				}
				// RFC 5321 §3.3 + §4.1.1.3: the syntax is exactly
				// `RCPT TO:<forward-path>`. Same no-space, mandatory-
				// brackets rule as MAIL FROM.
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.3
				const envelope = parseEnvelopeArg(commandArgument, 'TO');
				if (envelope === null || envelope.path === '') {
					await this.reply(501, SMTP_REPLY_TEXT.syntaxError);
					break;
				}
				// RFC 5321 §4.1.1.3: Rcpt-parameters share the esmtp-param
				// grammar. Keywords are ignored (this sink implements none),
				// but a malformed parameter list is still a syntax error.
				if (parseEsmtpParameters(envelope.parameters) === null) {
					await this.reply(501, SMTP_REPLY_TEXT.syntaxError);
					break;
				}
				// Explicit null check (not falsy): an empty string is a
				// valid null reverse-path (`MAIL FROM:<>`, RFC 5321
				// §4.5.5) and must not gate RCPT.
				if (this.mailFrom === null) {
					await this.reply(503, SMTP_REPLY_TEXT.badSequence);
					break;
				}
				this.recipientPaths.push(envelope.path);
				await this.reply(250, SMTP_REPLY_TEXT.ok);
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
					await this.reply(503, SMTP_REPLY_TEXT.badSequence);
					break;
				}
				await this.reply(354, SMTP_REPLY_TEXT.startMailInput);
				this.dataMode = true;
				this.dataLines = [];
				this.dataBytes = 0;
				break;
			}

			case 'RSET':
				// RFC 5321 §4.1.1.5: abort the current mail transaction.
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.5
				this.resetEnvelope();
				await this.reply(250, SMTP_REPLY_TEXT.ok);
				break;

			case 'NOOP':
				// RFC 5321 §4.1.1.9: NOOP has no effect except returning OK.
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.9
				await this.reply(250, SMTP_REPLY_TEXT.ok);
				break;

			case 'VRFY':
				// RFC 5321 §3.5.3: 252 means we cannot verify, but will accept mail.
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-3.5.3
				await this.reply(252, SMTP_REPLY_TEXT.cannotVrfyUser);
				break;

			case 'QUIT':
				// RFC 5321 §4.1.1.10: successful QUIT returns 221, then closes.
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.10
				await this.reply(
					221,
					`${SERVER_NAME} Service closing transmission channel`
				);
				await this.close();
				break;

			case 'EXPN':
			case 'HELP':
			case 'TURN':
				// RFC 5321 §4.2.4: 502 means recognized but not implemented.
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.2.4
				await this.reply(502, SMTP_REPLY_TEXT.commandNotImplemented);
				break;

			default:
				// RFC 5321 §4.2.4: 500 means the command was not recognized.
				// https://www.rfc-editor.org/rfc/rfc5321.html#section-4.2.4
				await this.reply(500, SMTP_REPLY_TEXT.commandUnrecognized);
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
				await this.reply(552, SMTP_REPLY_TEXT.messageSizeExceeded);
				this.resetEnvelope();
				return;
			}
			// Reassemble the on-wire payload: reader stripped the CRLF
			// terminators when splitting lines, so re-join with CRLF (the
			// SMTP line ending) and append one for the final line.
			// https://www.rfc-editor.org/rfc/rfc5321.html#section-2.3.8
			const raw = this.dataLines.join('\r\n') + '\r\n';
			let message: CaughtMessage;
			try {
				message = {
					receivedAt: new Date().toISOString(),
					...parseMessage(
						raw,
						this.mailFrom ?? '',
						this.recipientPaths
					),
					raw,
					rawSize: this.dataBytes,
				};
			} catch {
				// A parser exception here would reject the writeQueue chain
				// and silently drop every later command, desyncing the SMTP
				// session. Deliver the unparsed message instead.
				message = {
					receivedAt: new Date().toISOString(),
					from: this.mailFrom ?? '',
					to: this.recipientPaths.join(', '),
					subject: '(no subject)',
					headers: {},
					attachments: [],
					raw,
					rawSize: this.dataBytes,
				};
			}

			this.onEmail(message);

			await this.reply(250, SMTP_REPLY_TEXT.ok);
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
		// RFC 4954 §4: during a SASL exchange the client may send a
		// single "*" to abort the authentication; the server must then
		// reject it with a 501 rather than continuing the challenge.
		// https://www.rfc-editor.org/rfc/rfc4954.html#section-4
		if (line === '*') {
			this.authPending = false;
			this.authState = null;
			await this.reply(501, SMTP_REPLY_TEXT.authCanceled);
			return;
		}

		if (this.authState.mechanism === 'PLAIN') {
			const isValid = await this.handleAuthPlain(line.trim());
			if (isValid === null) {
				await this.rejectAuthSyntax();
			} else {
				await this.finishAuth(isValid);
			}
			return;
		}

		if (this.authState.mechanism === 'LOGIN') {
			if (this.authState.stage === 'username') {
				let username: string;
				try {
					username = decodeBase64ToString(line.trim());
				} catch {
					await this.rejectAuthSyntax();
					return;
				}
				this.authState = {
					mechanism: 'LOGIN',
					stage: 'password',
					username,
				};
				await this.reply(334, encodeStringAsBase64('Password:'));
				return;
			}
			if (this.authState.stage === 'password') {
				let password: string;
				try {
					password = decodeBase64ToString(line.trim());
				} catch {
					await this.rejectAuthSyntax();
					return;
				}
				const isValid = await this.authValidator('LOGIN', {
					username: this.authState.username || '',
					password,
				});
				await this.finishAuth(isValid);
				return;
			}
		}
	}

	private async handleAuthPlain(
		initialBase64: string
	): Promise<boolean | null> {
		let decoded: string;
		try {
			decoded = decodeBase64ToString(initialBase64);
		} catch {
			return null;
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
			await this.reply(235, SMTP_REPLY_TEXT.authSucceeded);
		} else {
			await this.reply(535, SMTP_REPLY_TEXT.authCredentialsInvalid);
		}
	}

	private async rejectAuthSyntax() {
		this.authPending = false;
		this.authState = null;
		await this.reply(501, SMTP_REPLY_TEXT.syntaxError);
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
 * path and the trailing ESMTP parameter list. Returns `null` if the
 * syntax does not match RFC 5321.
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
): { path: string; parameters: string } | null {
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
	return {
		path: commandArgument.slice(prefix.length, close),
		parameters: tail.slice(1),
	};
}

/**
 * Parses a space-separated ESMTP command parameter list into an
 * upper-cased keyword → value record, or `null` when any token violates
 * the RFC 5321 §4.1.1.2 grammar:
 *
 *   esmtp-param   = esmtp-keyword ["=" esmtp-value]
 *   esmtp-keyword = (ALPHA / DIGIT) *(ALPHA / DIGIT / "-")
 *   esmtp-value   = 1*(%d33-60 / %d62-126) ; printable except "="
 *
 * A keyword without "=" maps to the empty string. This intentionally does
 * not use `getHeaderParameter()` below: MIME headers use semicolon-separated
 * parameters, while SMTP commands do not.
 *
 * https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.2
 */
function parseEsmtpParameters(
	parameters: string
): Record<string, string> | null {
	const parsed: Record<string, string> = {};
	if (parameters === '') return parsed;
	for (const parameter of parameters.split(' ')) {
		const match = parameter.match(
			/^([A-Za-z0-9][A-Za-z0-9-]*)(?:=([\x21-\x3C\x3E-\x7E]+))?$/
		);
		if (!match) return null;
		parsed[match[1].toUpperCase()] = match[2] ?? '';
	}
	return parsed;
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
	// Match the encoded-word grammar `=?charset?encoding?encoded-text?=`.
	// https://www.rfc-editor.org/rfc/rfc2047.html#section-2
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
			// Decode the reconstructed octets using the declared charset,
			// falling back to UTF-8 when the label is unsupported. Charset
			// labels are matched case-insensitively and aliases like `utf8`
			// resolve to `utf-8`, so the sender's spelling is passed as-is.
			// https://encoding.spec.whatwg.org/#names-and-labels
			try {
				return new TextDecoder(charset).decode(bytes);
			} catch {
				return new TextDecoder().decode(bytes);
			}
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

/**
 * Splits a MIME header value into its main value and a lower-cased
 * parameter name → value map, e.g. `multipart/mixed; boundary="B"` becomes
 * `{ value: 'multipart/mixed', parameters: { boundary: 'B' } }`.
 *
 * Best-effort RFC 2045 §5.1 parameter parsing that never throws:
 *
 * - quoted values may contain ";" and use backslash quoted-pairs
 * - unquoted values end at the next ";" with surrounding whitespace
 *   treated as a separator, not as part of the value
 * - the first occurrence of a duplicated parameter wins
 *
 * RFC 2231 extended parameters (`filename*`, `filename*0`, …) are kept as
 * distinct names so a `filename` lookup never matches them; this sink does
 * not decode them.
 *
 * https://www.rfc-editor.org/rfc/rfc2045.html#section-5.1
 */
function parseHeaderValueAndParameters(headerValue: string): {
	value: string;
	parameters: Record<string, string>;
} {
	const semicolonIndex = headerValue.indexOf(';');
	if (semicolonIndex < 0) {
		return { value: headerValue.trim(), parameters: {} };
	}
	const value = headerValue.slice(0, semicolonIndex).trim();
	const parameters: Record<string, string> = {};
	let position = semicolonIndex + 1;
	while (position < headerValue.length) {
		// Skip separators between parameters.
		while (
			position < headerValue.length &&
			(headerValue[position] === ';' ||
				headerValue[position] === ' ' ||
				headerValue[position] === '\t')
		) {
			position++;
		}
		let nameEnd = position;
		while (
			nameEnd < headerValue.length &&
			headerValue[nameEnd] !== '=' &&
			headerValue[nameEnd] !== ';'
		) {
			nameEnd++;
		}
		const name = headerValue.slice(position, nameEnd).trim().toLowerCase();
		if (nameEnd >= headerValue.length || headerValue[nameEnd] === ';') {
			// A parameter without "=" carries no value.
			if (name && !(name in parameters)) parameters[name] = '';
			position = nameEnd;
			continue;
		}
		position = nameEnd + 1;
		while (
			position < headerValue.length &&
			(headerValue[position] === ' ' || headerValue[position] === '\t')
		) {
			position++;
		}
		let parameterValue: string;
		if (headerValue[position] === '"') {
			position++;
			let unquoted = '';
			while (
				position < headerValue.length &&
				headerValue[position] !== '"'
			) {
				// RFC 822 quoted-pair: a backslash escapes the next character.
				if (
					headerValue[position] === '\\' &&
					position + 1 < headerValue.length
				) {
					unquoted += headerValue[position + 1];
					position += 2;
				} else {
					unquoted += headerValue[position];
					position++;
				}
			}
			position++;
			parameterValue = unquoted;
			// Discard any garbage between the closing quote and the next ";".
			while (
				position < headerValue.length &&
				headerValue[position] !== ';'
			) {
				position++;
			}
		} else {
			let valueEnd = position;
			while (
				valueEnd < headerValue.length &&
				headerValue[valueEnd] !== ';'
			) {
				valueEnd++;
			}
			parameterValue = headerValue.slice(position, valueEnd).trim();
			position = valueEnd;
		}
		if (name && !(name in parameters)) parameters[name] = parameterValue;
	}
	return { value, parameters };
}

/**
 * Result of walking a message's MIME tree: the selected body parts plus
 * every non-body part collected as an attachment.
 */
type ParsedMimeParts = {
	/** Decoded first non-attachment text/plain part, if any. */
	text?: string;
	/** Decoded first non-attachment text/html part, if any. */
	html?: string;
	/** Non-body parts in message order. */
	attachments: CaughtAttachment[];
};

/**
 * Classification-relevant metadata of one MIME part, extracted from its
 * parsed headers.
 */
type MimePartMetadata = {
	/** Lower-cased media type without parameters. */
	mediaType: string;
	/** `boundary` parameter of multipart media types. */
	boundary?: string;
	/** Lower-cased Content-Disposition type token; `''` when absent. */
	dispositionType: string;
	/** Decoded filename; `undefined` when absent. */
	filename?: string;
	/** Content-ID without its angle brackets; `undefined` when absent. */
	contentId?: string;
};

// PHPMailer nests at most three multipart levels (mixed > related >
// alternative). Anything meaningfully deeper is hostile or corrupt input;
// cap the recursion so a crafted message cannot overflow the call stack.
const MAX_MULTIPART_NESTING_DEPTH = 10;

function collectMimePartsFromMultipart(
	body: string,
	boundary: string,
	depth = 0
): ParsedMimeParts {
	const found: ParsedMimeParts = { attachments: [] };
	// RFC 2046 §5.1 defines multipart boundary delimiter lines.
	// https://www.rfc-editor.org/rfc/rfc2046.html#section-5.1
	const boundaryDelimiter = `--${boundary}`;
	const closingBoundaryDelimiter = `--${boundary}--`;
	const lines = body.split('\r\n');
	let currentPartLines: string[] = [];
	const parts: string[] = [];
	let inPart = false;
	for (const line of lines) {
		// RFC 2046 §5.1.1: a boundary delimiter line may end with transport
		// padding (linear whitespace) that parsers must ignore.
		const delimiterCandidate = line.replace(/[ \t]+$/, '');
		if (delimiterCandidate === boundaryDelimiter) {
			if (inPart && currentPartLines.length) {
				parts.push(currentPartLines.join('\r\n'));
			}
			inPart = true;
			currentPartLines = [];
		} else if (delimiterCandidate === closingBoundaryDelimiter) {
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
	// Walk every part in message order — even after both body slots are
	// taken, later parts may still be attachments.
	for (const part of parts) {
		const { headerRaw, bodyRaw } = splitHeaderBody(part);
		const partHeaders = parseHeaderLines(headerRaw);
		const metadata = parseMimePartMetadata(partHeaders);
		if (metadata.mediaType.startsWith('multipart/')) {
			// RFC 2046 §5.1.3 allows nested multipart entities — e.g.
			// PHPMailer wraps a multipart/alternative body in multipart/mixed
			// when the message carries attachments, and multipart/related
			// groups an HTML body with its inline resources. Recurse and
			// merge: first-found bodies win, attachments accumulate in
			// message order.
			// https://www.rfc-editor.org/rfc/rfc2046.html#section-5.1.3
			if (metadata.boundary && depth < MAX_MULTIPART_NESTING_DEPTH) {
				const nestedParts = collectMimePartsFromMultipart(
					bodyRaw,
					metadata.boundary,
					depth + 1
				);
				found.text ??= nestedParts.text;
				found.html ??= nestedParts.html;
				found.attachments.push(...nestedParts.attachments);
			}
			continue;
		}
		classifyMimePart(metadata, partHeaders, bodyRaw, found);
	}
	return found;
}

/**
 * Classifies one non-multipart MIME part by the first matching rule,
 * mutating `found`:
 *
 *   1. `Content-Disposition: attachment` → attachment (RFC 2183 §2: such
 *      parts are separate from the main document).
 *   2. has a filename → attachment regardless of disposition: a text part
 *      WITH a filename is a text-file attachment, not the message body.
 *   3. text/plain and the text slot is empty → text body.
 *   4. text/html and the html slot is empty → html body.
 *   5. `Content-Disposition: inline` → attachment (e.g. cid: images in
 *      multipart/related). Checked after rules 3-4 because some mailers
 *      mark the main body "inline" — a filename-less inline text part must
 *      win an empty body slot, never become an attachment.
 *   6. has a Content-ID → attachment. RFC 2387 does not require a
 *      Content-Disposition on multipart/related resources, and some
 *      clients emit cid: resources with only a Content-ID.
 *   7. media type is not text/* → attachment: hand-rolled mail() MIME
 *      sometimes ships binary parts with no disposition, filename, or
 *      Content-ID, and a debugging sink should still surface them.
 *   8. otherwise ignore — leftover text/* parts with no attachment signal,
 *      e.g. a second text/plain part after the text slot is taken. They
 *      remain available in the raw message.
 *
 * https://www.rfc-editor.org/rfc/rfc2183.html#section-2
 * https://www.rfc-editor.org/rfc/rfc2387.html
 */
function classifyMimePart(
	metadata: MimePartMetadata,
	partHeaders: Record<string, string>,
	bodyRaw: string,
	found: ParsedMimeParts
): void {
	// Rules 1-2.
	if (
		metadata.dispositionType === 'attachment' ||
		metadata.filename !== undefined
	) {
		found.attachments.push(
			makeCaughtAttachment(metadata, partHeaders, bodyRaw)
		);
		return;
	}
	// Rules 3-4. A decoded body part may legitimately be an empty string,
	// so the first-match-wins checks compare against undefined, not
	// truthiness.
	if (metadata.mediaType === 'text/plain' && found.text === undefined) {
		found.text = decodeTextPart(partHeaders, bodyRaw);
		return;
	}
	if (metadata.mediaType === 'text/html' && found.html === undefined) {
		found.html = decodeTextPart(partHeaders, bodyRaw);
		return;
	}
	// Rules 5-7; anything left over is rule 8 and is ignored.
	if (
		metadata.dispositionType === 'inline' ||
		metadata.contentId !== undefined ||
		!metadata.mediaType.startsWith('text/')
	) {
		found.attachments.push(
			makeCaughtAttachment(metadata, partHeaders, bodyRaw)
		);
	}
}

function parseMimePartMetadata(
	partHeaders: Record<string, string>
): MimePartMetadata {
	const contentType = parseHeaderValueAndParameters(
		partHeaders['content-type'] || 'text/plain'
	);
	const disposition = parseHeaderValueAndParameters(
		partHeaders['content-disposition'] || ''
	);
	// Prefer `Content-Disposition: filename=`, fall back to
	// `Content-Type: name=`. PHPMailer nests RFC 2047 encoded-words inside
	// the quotes (`filename="=?utf-8?B?...?="`), so the parameter parser
	// unquotes first and encoded-word decoding comes second.
	const rawFilename =
		disposition.parameters['filename'] || contentType.parameters['name'];
	const contentIdRaw = partHeaders['content-id'];
	return {
		mediaType: contentType.value.toLowerCase() || 'text/plain',
		boundary: contentType.parameters['boundary'],
		dispositionType: disposition.value.toLowerCase(),
		filename: rawFilename
			? decodeRfc2047EncodedWords(rawFilename)
			: undefined,
		// Strip one pair of surrounding angle brackets so `<logo>` matches
		// `cid:logo` references; keep malformed bracket-less values as-is.
		contentId:
			contentIdRaw === undefined
				? undefined
				: contentIdRaw.replace(/^<(.*)>$/, '$1'),
	};
}

function makeCaughtAttachment(
	metadata: MimePartMetadata,
	partHeaders: Record<string, string>,
	bodyRaw: string
): CaughtAttachment {
	const content = decodeAttachmentBytes(partHeaders, bodyRaw);
	return {
		filename: metadata.filename,
		contentType: metadata.mediaType,
		contentDisposition: metadata.dispositionType,
		contentId: metadata.contentId,
		headers: partHeaders,
		content,
		size: content.byteLength,
	};
}

function decodeTextPart(
	headers: Record<string, string>,
	content: string
): string {
	const encoding = (headers['content-transfer-encoding'] || '').toLowerCase();
	const bytes = decodeTransferEncodedBytes(encoding, content);
	// Invalid base64 and non-base64/quoted-printable encodings pass the
	// content string through untouched, with no charset decoding: those
	// wire bytes were already UTF-8-decoded once at intake, and re-encoding
	// them through a mislabeled charset (PHPMailer defaults to iso-8859-1)
	// would turn valid UTF-8 bodies into mojibake.
	if (bytes === null) {
		return content;
	}
	const charset =
		parseHeaderValueAndParameters(headers['content-type'] || '').parameters[
			'charset'
		] || 'utf-8';
	// Decode with the declared charset, falling back to UTF-8 when the label
	// is unsupported. https://encoding.spec.whatwg.org/#names-and-labels
	try {
		return new TextDecoder(charset).decode(bytes);
	} catch {
		return new TextDecoder().decode(bytes);
	}
}

function decodeAttachmentBytes(
	headers: Record<string, string>,
	content: string
): Uint8Array {
	const encoding = (headers['content-transfer-encoding'] || '').toLowerCase();
	const bytes = decodeTransferEncodedBytes(encoding, content);
	// 7bit, 8bit, absent, unknown encodings, and invalid base64 all fall
	// back to the UTF-8 bytes of the content string. Raw 8-bit binary
	// cannot survive either capture path (both decode intake as UTF-8
	// text), so there is no lossless-binary case to preserve here.
	return bytes ?? new TextEncoder().encode(content);
}

/**
 * Decodes a base64 or quoted-printable part body into bytes. Returns `null`
 * for any other transfer encoding, or when base64 input is invalid — each
 * caller chooses its own fallback for those cases.
 *
 * `decodeBase64ToUint8Array` is `atob`-based and therefore implements WHATWG
 * forgiving-base64, so line-wrapped MIME base64 decodes without stripping
 * the CRLFs first.
 */
function decodeTransferEncodedBytes(
	encoding: string,
	content: string
): Uint8Array | null {
	if (encoding === 'base64') {
		try {
			return decodeBase64ToUint8Array(content);
		} catch {
			return null;
		}
	}
	if (encoding === 'quoted-printable') {
		// RFC 2045 §6.7: "=\r\n" is a soft line break; "=XX" injects one
		// raw octet. https://www.rfc-editor.org/rfc/rfc2045.html#section-6.7
		const softLineBreaksRemoved = content.replace(/=\r\n/g, '');
		const decodedBytes: number[] = [];
		for (let i = 0; i < softLineBreaksRemoved.length; i++) {
			const char = softLineBreaksRemoved[i];
			if (char === '=' && i + 2 < softLineBreaksRemoved.length) {
				const hexByte = softLineBreaksRemoved.slice(i + 1, i + 3);
				if (/^[0-9A-Fa-f]{2}$/.test(hexByte)) {
					decodedBytes.push(parseInt(hexByte, 16));
					i += 2;
					continue;
				}
			}
			decodedBytes.push(char.charCodeAt(0));
		}
		return new Uint8Array(decodedBytes);
	}
	return null;
}

/**
 * Parses the message content received after SMTP DATA into convenient fields.
 *
 * This is intentionally a small RFC 5322/MIME helper for the SMTP sink, not a
 * full mail user-agent parser. It handles the header/body split, folded
 * headers, RFC 2047 encoded words, common text transfer encodings, and walks
 * the MIME tree — including nested multiparts such as multipart/mixed
 * wrapping multipart/alternative or multipart/related — selecting the first
 * non-attachment text/plain and text/html parts as the message body.
 *
 * Non-body parts are collected into `attachments` in message order: parts
 * marked `Content-Disposition: attachment`, parts carrying a filename,
 * inline resources such as cid: images (with or without a
 * Content-Disposition header), and metadata-less non-text parts. A
 * single-part message whose body declares attachment metadata becomes one
 * attachment with no `text`/`html`. Leftover text parts with no attachment
 * signal — e.g. a second text/plain part after the text slot is taken — are
 * dropped from the structured fields but remain available in `raw`.
 */
export function parseMessage(
	raw: string,
	fallbackFrom: string,
	fallbackRecipients: string[]
): {
	headers: Record<string, string>;
	subject: string;
	text?: string;
	html?: string;
	attachments: CaughtAttachment[];
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

	const metadata = parseMimePartMetadata(headers);
	let text: string | undefined;
	let html: string | undefined;
	let attachments: CaughtAttachment[] = [];
	if (metadata.mediaType.startsWith('multipart/')) {
		if (metadata.boundary) {
			({ text, html, attachments } = collectMimePartsFromMultipart(
				bodyRaw,
				metadata.boundary
			));
		}
	} else if (
		metadata.dispositionType === 'attachment' ||
		metadata.filename !== undefined
	) {
		// Classification rules 1-2 apply to the top-level body of a
		// single-part message: attachment metadata beats the body slots,
		// e.g. a hand-rolled mail() call sending one attachment without a
		// multipart wrapper.
		attachments.push(makeCaughtAttachment(metadata, headers, bodyRaw));
	} else if (metadata.mediaType === 'text/plain') {
		text = decodeTextPart(headers, bodyRaw);
	} else if (metadata.mediaType === 'text/html') {
		html = decodeTextPart(headers, bodyRaw);
	} else {
		// Rules 5-8 do not apply at the top level: a metadata-less body of
		// an unknown type keeps the text fallback so no such message
		// arrives fully empty.
		text = bodyRaw;
	}
	return { headers, subject, text, html, attachments, from, to };
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
