import PostalMime from 'postal-mime';
import type {
	Address as PostalAddress,
	Attachment as PostalAttachment,
	Email as PostalEmail,
	RawEmail as PostalRawEmail,
} from 'postal-mime';
import { decodeBase64ToString, encodeStringAsBase64 } from './base64';

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
 * A non-body MIME part captured from a message: a regular attachment or an
 * inline resource such as a `cid:` image.
 */
export type CaughtAttachment = {
	/** Decoded filename from the parsed MIME part metadata. */
	filename?: string;
	/** Lower-cased media type without parameters, e.g. `application/pdf`. */
	contentType: string;
	/**
	 * Lower-cased `Content-Disposition` type token with parameters stripped,
	 * or `''` when the header is absent or carries no parseable token.
	 */
	contentDisposition: string;
	/**
	 * `Content-ID` value with one pair of surrounding angle brackets
	 * stripped, so `<logo>` matches `cid:logo` references. Absent when the
	 * header is missing.
	 */
	contentId?: string;
	/** Parsed part headers as a lower-cased name/value map, when available. */
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
					...(await parseMessage(
						raw,
						this.mailFrom ?? '',
						this.recipientPaths
					)),
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
 * Parses the message content received after SMTP DATA into convenient fields.
 *
 * The SMTP sink owns the transport protocol. RFC 5322/MIME interpretation is
 * delegated to `postal-mime`, which supports browser and Node.js runtimes.
 */
export async function parseMessage(
	raw: PostalRawEmail,
	fallbackFrom: string,
	fallbackRecipients: string[]
): Promise<{
	headers: Record<string, string>;
	subject: string;
	text?: string;
	html?: string;
	attachments: CaughtAttachment[];
	from: string;
	to: string;
}> {
	const parsed = await PostalMime.parse(raw, {
		attachmentEncoding: 'arraybuffer',
	});
	const headers = mapHeaders(parsed);
	const from = formatAddress(parsed.from) || fallbackFrom;
	const to = formatRecipients(parsed) || fallbackRecipients.join(', ');
	const subject = parsed.subject || '(no subject)';
	const attachments = parsed.attachments.map(mapAttachment);
	const text = parsed.text;
	const html = parsed.html;
	return { headers, subject, text, html, attachments, from, to };
}

function mapHeaders(parsed: PostalEmail): Record<string, string> {
	const headers: Record<string, string> = {};
	for (const header of parsed.headers) {
		headers[header.key] = headers[header.key]
			? `${headers[header.key]}, ${header.value}`
			: header.value;
	}
	return headers;
}

function formatRecipients(parsed: PostalEmail): string {
	const recipients = [
		...(parsed.to || []),
		...(parsed.cc || []),
		...(parsed.bcc || []),
	];
	return formatAddresses(recipients);
}

function formatAddresses(addresses: PostalAddress[]): string {
	return addresses.map(formatAddress).filter(Boolean).join(', ');
}

function formatAddress(address: PostalAddress | undefined): string {
	if (!address) return '';
	if ('group' in address && Array.isArray(address.group)) {
		return formatAddresses(address.group);
	}
	if (!('address' in address) || !address.address) {
		return '';
	}
	return address.name
		? `${address.name} <${address.address}>`
		: address.address;
}

function mapAttachment(attachment: PostalAttachment): CaughtAttachment {
	const content = attachmentContentToUint8Array(attachment.content);
	const contentId = attachment.contentId
		? attachment.contentId.replace(/^<(.*)>$/, '$1')
		: undefined;
	return {
		filename: attachment.filename || undefined,
		contentType: attachment.mimeType.toLowerCase(),
		contentDisposition: attachment.disposition || '',
		contentId,
		headers: {},
		content,
		size: content.byteLength,
	};
}

function attachmentContentToUint8Array(
	content: PostalAttachment['content']
): Uint8Array {
	if (content instanceof Uint8Array) {
		return content;
	}
	if (content instanceof ArrayBuffer) {
		return new Uint8Array(content);
	}
	return new TextEncoder().encode(content);
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
