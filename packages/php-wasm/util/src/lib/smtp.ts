// smtp-sink.ts — in-process SMTP receiver with optional SASL AUTH.
//
// Scope: catches outbound mail from PHP (via PHPMailer, fsockopen,
// or anything else that speaks plain SMTP). STARTTLS is not
// supported because the loopback duplex carries no real network
// traffic and there is nothing to encrypt; clients that need TLS
// against this sink should be configured for plain SMTP instead.

export type ByteDuplex = {
	readable: ReadableStream<Uint8Array>;
	writable: WritableStream<Uint8Array>;
};

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

type SaslMech = 'PLAIN' | 'LOGIN';

// Server identifier used in the 220 greeting and as the Domain
// token in the EHLO/HELO 250 response (RFC 5321 §4.1.1.1 ABNF
// requires the first token after "250"/"250-" to be a Domain).
const SERVER_NAME = 'localhost';

export type AuthValidator = (
	mech: SaslMech,
	cred: { username: string; password: string }
) => boolean | Promise<boolean>;

export type SmtpSinkOptions = {
	maxSize?: number;
	auth?: {
		mechs?: SaslMech[]; // which mechanisms to offer
		advertise?: boolean; // show AUTH on EHLO
		requireAuth?: boolean; // 530 before MAIL/RCPT unless authenticated
		validator?: AuthValidator; // check creds; default accepts anything
	};
};

/**
 * SMTP server sink that receives emails and invokes a callback for
 * each fully-received message.
 */
export class SmtpSink {
	private enc = new TextEncoder();
	private dec = new TextDecoder('utf-8', { fatal: false });
	private lineBuf = '';
	private dataMode = false;
	private dataLines: string[] = [];
	private dataBytes = 0;
	private mailFrom: string | null = null;
	private rcpts: string[] = [];
	private writer: WritableStreamDefaultWriter<Uint8Array>;
	private reader: ReadableStreamDefaultReader<Uint8Array>;
	private closed = false;
	private readonly maxSize: number;

	// sequencing so replies stay in order
	private seq: Promise<void> = Promise.resolve();

	// AUTH policy
	private authAdvertise: boolean;
	private authMechs: SaslMech[];
	private authRequire: boolean;
	private authValidator: AuthValidator;
	private authenticated = false;
	private authPending = false;
	private authState:
		| { mech: 'PLAIN'; stage: 'waitInitial' }
		| { mech: 'LOGIN'; stage: 'username' | 'password'; username?: string }
		| null = null;

	private onEmail: (m: CaughtMessage) => void;

	constructor(
		duplex: ByteDuplex,
		onEmail: (m: CaughtMessage) => void,
		opts: SmtpSinkOptions = {}
	) {
		this.onEmail = onEmail;
		this.writer = duplex.writable.getWriter();
		this.reader = duplex.readable.getReader();
		this.maxSize = opts.maxSize ?? 10 * 1024 * 1024;

		this.authMechs = opts.auth?.mechs ?? [];
		this.authAdvertise = opts.auth?.advertise ?? this.authMechs.length > 0;
		this.authRequire = opts.auth?.requireAuth ?? false;
		this.authValidator = opts.auth?.validator ?? (async () => true);
	}

	async start(): Promise<void> {
		await this.reply(220, `${SERVER_NAME} ESMTP ready`);
		for (;;) {
			const r = await this.reader.read();
			if (r.done) break;
			this.consumeChunk(r.value);
			if (this.closed) break;
		}
		// Wait for all enqueued handlers to finish before closing
		// the writer. When the client closes the connection, the
		// reader gets done immediately, but enqueued handlers
		// (like handleDataLine(".") which delivers the email) may
		// still be pending in the promise chain.
		await this.seq;
		await this.close();
	}

	private async close(): Promise<void> {
		if (this.closed) return;
		this.closed = true;
		await this.writer.close();
	}

	private consumeChunk(chunk: Uint8Array) {
		const text = this.dec.decode(chunk, { stream: true });
		this.lineBuf += text;

		for (;;) {
			const idx = this.lineBuf.indexOf('\r\n');
			if (idx < 0) break;
			const line = this.lineBuf.slice(0, idx);
			this.lineBuf = this.lineBuf.slice(idx + 2);

			this.enqueue(async () => {
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
		// If the un-terminated tail of lineBuf has already grown past
		// the limit that applies to the current mode, the peer is
		// malformed (or hostile); refuse it and drop the session
		// rather than letting lineBuf grow without bound.
		const maxLineLen = this.dataMode ? 1000 : 512;
		if (this.lineBuf.length > maxLineLen) {
			this.lineBuf = '';
			this.enqueue(async () => {
				await this.reply(500, 'line too long');
				await this.close();
			});
		}
	}

	private enqueue(fn: () => Promise<void>) {
		this.seq = this.seq.then(fn);
	}

	private async handleCommand(rawLine: string) {
		const line = rawLine.trimEnd();
		const sp = line.indexOf(' ');
		const cmd = (sp < 0 ? line : line.slice(0, sp)).toUpperCase();
		const arg = sp < 0 ? '' : line.slice(sp + 1);

		switch (cmd) {
			case 'EHLO':
			case 'HELO': {
				// RFC 5321 §4.1.1.1 ABNF: both `helo` and `ehlo`
				// require a Domain (or address-literal for EHLO)
				// argument; an empty argument is a syntax error.
				if (!arg.trim()) {
					await this.reply(501, `syntax: ${cmd} <domain>`);
					break;
				}
				// RFC 5321 §4.1.4: a successful EHLO/HELO issued mid-
				// session MUST clear all buffers and reset state exactly
				// as RSET would. Auth state is preserved (RFC 4954 §4).
				this.resetEnvelope();
				if (cmd === 'HELO') {
					// RFC 5321 §4.1.1.1 ABNF:
					//   ehlo-ok-rsp = "250" SP Domain [ SP ehlo-greet ]
					// HELO uses the same single-line form. The first
					// token after the reply code MUST be the server's
					// Domain, optionally followed by free-form text.
					await this.reply(250, `${SERVER_NAME} Hello ${arg}`);
					break;
				}
				// RFC 5321 §4.1.1.1 ABNF for the multi-line response:
				//   "250-" Domain [ SP ehlo-greet ] CRLF
				//   *( "250-" ehlo-line CRLF )
				//   "250" SP ehlo-line CRLF
				// The first line therefore starts with the server's
				// Domain, never with free-form text.
				const ext: string[] = [];
				if (this.authAdvertise && this.authMechs.length) {
					const list = this.authMechs.join(' ');
					ext.push(`AUTH ${list}`, `AUTH=${list}`);
				}
				ext.push(`SIZE ${this.maxSize}`, 'PIPELINING');
				await this.replyMulti(250, [
					`${SERVER_NAME} Hello ${arg}`,
					...ext,
				]);
				break;
			}

			case 'STARTTLS': {
				// The loopback duplex carries no real network traffic
				// so there is nothing to encrypt. STARTTLS is never
				// advertised in EHLO and is always refused with 502
				// "Command not implemented" if a client tries it
				// anyway. Clients that need TLS should be configured
				// for plain SMTP against this sink.
				await this.reply(502, 'Command not implemented');
				break;
			}

			case 'AUTH': {
				const [mechRaw, initialRaw] = arg.split(/\s+/, 2);
				const mech = (mechRaw || '').toUpperCase() as SaslMech;

				if (!mech) {
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

				if (!this.authMechs.includes(mech)) {
					await this.reply(504, 'Unrecognized authentication type');
					break;
				}

				if (mech === 'PLAIN') {
					const init = normalizeInitial(initialRaw);
					if (init == null) {
						this.authPending = true;
						this.authState = {
							mech: 'PLAIN',
							stage: 'waitInitial',
						};
						await this.reply(334, ''); // empty challenge
					} else {
						const ok = await this.handleAuthPlain(init);
						await this.finishAuth(ok);
					}
					break;
				}

				if (mech === 'LOGIN') {
					const init = normalizeInitial(initialRaw);
					if (init != null) {
						// initial response is username
						const username = b64DecodeText(init);
						this.authPending = true;
						this.authState = {
							mech: 'LOGIN',
							stage: 'password',
							username,
						};
						await this.reply(334, b64('Password:'));
					} else {
						this.authPending = true;
						this.authState = { mech: 'LOGIN', stage: 'username' };
						await this.reply(334, b64('Username:'));
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
				const path = parseEnvelopeArg(arg, 'FROM');
				if (path === null) {
					await this.reply(501, 'syntax: MAIL FROM:<addr>');
					break;
				}
				this.mailFrom = path;
				this.rcpts = [];
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
				const path = parseEnvelopeArg(arg, 'TO');
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
				this.rcpts.push(path);
				await this.reply(250, 'Accepted');
				break;
			}

			case 'DATA': {
				if (this.mailFrom === null || this.rcpts.length === 0) {
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
				this.resetEnvelope();
				await this.reply(250, 'OK');
				break;

			case 'NOOP':
				await this.reply(250, 'OK');
				break;

			case 'VRFY':
				await this.reply(
					252,
					'Cannot VRFY user, but will accept message'
				);
				break;

			case 'QUIT':
				await this.reply(221, 'Bye');
				await this.close();
				break;

			case 'EXPN':
			case 'HELP':
			case 'TURN':
				await this.reply(502, 'Command not implemented');
				break;

			default:
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
				await this.reply(552, 'message size exceeds fixed limit');
				this.resetEnvelope();
				return;
			}
			const raw = this.dataLines.join('\r\n') + '\r\n';
			const { headers, subject, text, from, to } = parseMessage(
				raw,
				this.mailFrom ?? '',
				this.rcpts
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
		this.dataBytes += this.enc.encode(actual).byteLength + 2;
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

		if (this.authState.mech === 'PLAIN') {
			const ok = await this.handleAuthPlain(line.trim());
			await this.finishAuth(ok);
			return;
		}

		if (this.authState.mech === 'LOGIN') {
			if (this.authState.stage === 'username') {
				const username = b64DecodeText(line.trim());
				this.authState = { mech: 'LOGIN', stage: 'password', username };
				await this.reply(334, b64('Password:'));
				return;
			}
			if (this.authState.stage === 'password') {
				const password = b64DecodeText(line.trim());
				const ok = await this.authValidator('LOGIN', {
					username: this.authState.username || '',
					password,
				});
				await this.finishAuth(ok);
				return;
			}
		}
	}

	private async handleAuthPlain(initialB64: string): Promise<boolean> {
		let decoded = '';
		try {
			decoded = atob(initialB64);
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

	private async finishAuth(ok: boolean) {
		this.authPending = false;
		this.authState = null;
		if (ok) {
			this.authenticated = true;
			await this.reply(235, 'Authentication succeeded');
		} else {
			await this.reply(535, 'Authentication credentials invalid');
		}
	}

	private resetEnvelope() {
		this.mailFrom = null;
		this.rcpts = [];
		this.dataMode = false;
		this.dataLines = [];
		this.dataBytes = 0;
	}

	private async reply(code: number, text: string) {
		await this.writer.write(this.enc.encode(`${code} ${text}\r\n`));
	}
	private async replyMulti(code: number, lines: string[]) {
		for (let i = 0; i < lines.length - 1; i++) {
			await this.writer.write(this.enc.encode(`${code}-${lines[i]}\r\n`));
		}
		await this.writer.write(
			this.enc.encode(`${code} ${lines[lines.length - 1]}\r\n`)
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
 */
export function parseEnvelopeArg(
	arg: string,
	keyword: 'FROM' | 'TO'
): string | null {
	const prefix = `${keyword}:<`;
	if (arg.length < prefix.length + 1) return null;
	if (arg.slice(0, prefix.length).toUpperCase() !== prefix) {
		return null;
	}
	const close = arg.indexOf('>', prefix.length);
	if (close < 0) return null;
	// Anything past the closing bracket must either be empty or
	// begin with a single space introducing ESMTP parameters.
	const tail = arg.slice(close + 1);
	if (tail !== '' && !tail.startsWith(' ')) return null;
	return arg.slice(prefix.length, close);
}

/**
 * Extracts email addresses from an RFC 5322 address list.
 * Handles a mix of "Name <addr>" and bare "addr" entries.
 */
export function extractAddresses(value: string): string[] {
	const out: string[] = [];
	for (const part of value.split(',')) {
		const trimmed = part.trim();
		if (!trimmed) continue;
		const angle = trimmed.match(/<([^>]+)>/);
		if (angle) {
			out.push(angle[1].trim());
		} else if (trimmed.includes('@')) {
			out.push(trimmed);
		}
	}
	return out;
}

export function unfoldHeaders(hdr: string): string {
	return hdr.replace(/\r\n([ \t]+)/g, ' ');
}
export function splitHeaderBody(raw: string): {
	headerRaw: string;
	bodyRaw: string;
} {
	const idx = raw.indexOf('\r\n\r\n');
	if (idx < 0) return { headerRaw: raw, bodyRaw: '' };
	return { headerRaw: raw.slice(0, idx), bodyRaw: raw.slice(idx + 4) };
}
export function parseHeaderLines(headerRaw: string): Record<string, string> {
	const out: Record<string, string> = {};
	const unfolded = unfoldHeaders(headerRaw);
	const lines = unfolded.split('\r\n');
	for (const line of lines) {
		const i = line.indexOf(':');
		if (i <= 0) continue;
		const name = line.slice(0, i).toLowerCase();
		const val = line.slice(i + 1).trim();
		out[name] = (out[name] ? out[name] + ', ' : '') + val;
	}
	return out;
}
function decodeRfc2047(s: string): string {
	return s.replace(
		/=\?([^?]+)\?([BbQq])\?([^?]+)\?=/g,
		(_m, cs, enc, data) => {
			const charset = String(cs);
			const kind = String(enc).toUpperCase();
			let bytes: Uint8Array;
			if (kind === 'B') {
				const bin = atob(String(data));
				const arr = new Uint8Array(bin.length);
				for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
				bytes = arr;
			} else {
				let txt = String(data).replace(/_/g, ' ');
				txt = txt.replace(/=([0-9A-Fa-f]{2})/g, (_m, h) =>
					String.fromCharCode(parseInt(h, 16))
				);
				bytes = new Uint8Array([...txt].map((c) => c.charCodeAt(0)));
			}
			try {
				return new TextDecoder(normalizeCharset(charset)).decode(bytes);
			} catch {
				return new TextDecoder().decode(bytes);
			}
		}
	);
}
function normalizeCharset(cs: string): string {
	cs = cs.toLowerCase();
	return cs === 'utf8' ? 'utf-8' : cs;
}
function qpDecodeToBytes(s: string): Uint8Array {
	s = s.replace(/=\r\n/g, '');
	const out: number[] = [];
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (ch === '=' && i + 2 < s.length) {
			const h = s.slice(i + 1, i + 3);
			if (/^[0-9A-Fa-f]{2}$/.test(h)) {
				out.push(parseInt(h, 16));
				i += 2;
				continue;
			}
		}
		out.push(ch.charCodeAt(0));
	}
	return new Uint8Array(out);
}
function b64DecodeToBytes(s: string): Uint8Array {
	const bin = atob(s.replace(/\s+/g, ''));
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}
function b64DecodeText(s: string): string {
	const bytes = b64DecodeToBytes(s);
	return new TextDecoder().decode(bytes);
}
function b64(s: string): string {
	return btoa(s);
}
function stripQuotes(s: string): string {
	const m = s.match(/^"(.*)"$/);
	return m ? m[1] : s;
}
function getParam(h: string, name: string): string | null {
	const re = new RegExp(`;\\s*${name}=([^;]+)`, 'i');
	const m = h.match(re);
	return m ? stripQuotes(m[1]) : null;
}
function pickTextPlainFromMultipart(
	body: string,
	boundary: string
): { headers: Record<string, string>; content: string } | null {
	const b = `--${boundary}`;
	const end = `--${boundary}--`;
	const lines = body.split('\r\n');
	let cur: string[] = [];
	const parts: string[] = [];
	let inPart = false;
	for (const line of lines) {
		if (line === b) {
			if (inPart && cur.length) parts.push(cur.join('\r\n'));
			inPart = true;
			cur = [];
		} else if (line === end) {
			if (inPart && cur.length) parts.push(cur.join('\r\n'));
			inPart = false;
			break;
		} else if (inPart) {
			cur.push(line);
		}
	}
	if (inPart && cur.length) parts.push(cur.join('\r\n'));
	for (const p of parts) {
		const { headerRaw, bodyRaw } = splitHeaderBody(p);
		const ph = parseHeaderLines(headerRaw);
		const ct = (ph['content-type'] || 'text/plain').toLowerCase();
		if (ct.startsWith('text/plain'))
			return { headers: ph, content: bodyRaw };
	}
	return null;
}
function decodeBody(
	cte: string | undefined,
	charset: string | undefined,
	content: string
): string {
	cte = (cte || '').toLowerCase();
	const cs = normalizeCharset(charset || 'utf-8');
	let bytes: Uint8Array;
	if (cte === 'base64') bytes = b64DecodeToBytes(content);
	else if (cte === 'quoted-printable') bytes = qpDecodeToBytes(content);
	else bytes = new Uint8Array([...content].map((c) => c.charCodeAt(0)));
	try {
		return new TextDecoder(cs).decode(bytes);
	} catch {
		return new TextDecoder().decode(bytes);
	}
}
export function parseMessage(
	raw: string,
	fallbackFrom: string,
	fallbackRcpts: string[]
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
		? decodeRfc2047(headers['subject'])
		: '(no subject)';
	const from = headers['from']
		? decodeRfc2047(headers['from'])
		: fallbackFrom;
	const to = headers['to']
		? decodeRfc2047(headers['to'])
		: fallbackRcpts.join(', ');

	let text: string | undefined;
	const ct = (headers['content-type'] || 'text/plain').toLowerCase();
	if (ct.startsWith('multipart/')) {
		const boundary = getParam(headers['content-type'], 'boundary');
		if (boundary) {
			const part = pickTextPlainFromMultipart(bodyRaw, boundary);
			if (part) {
				const pcte = (
					part.headers['content-transfer-encoding'] || ''
				).toLowerCase();
				const pcharset =
					getParam(part.headers['content-type'] || '', 'charset') ||
					'utf-8';
				text = decodeBody(pcte, pcharset, part.content);
			}
		}
	} else if (ct.startsWith('text/plain')) {
		const cte = (headers['content-transfer-encoding'] || '').toLowerCase();
		const charset =
			getParam(headers['content-type'] || '', 'charset') || 'utf-8';
		text = decodeBody(cte, charset, bodyRaw);
	} else {
		text = bodyRaw;
	}
	return { headers, subject, text, from, to };
}

export function makeLoopbackPair(): [ByteDuplex, ByteDuplex] {
	const a2b = new TransformStream<Uint8Array, Uint8Array>();
	const b2a = new TransformStream<Uint8Array, Uint8Array>();
	const a: ByteDuplex = { readable: b2a.readable, writable: a2b.writable };
	const b: ByteDuplex = { readable: a2b.readable, writable: b2a.writable };
	return [a, b];
}

function normalizeInitial(x?: string): string | null {
	if (!x) return null;
	const t = x.trim();
	if (t === '' || t === '=') return null;
	return t;
}
