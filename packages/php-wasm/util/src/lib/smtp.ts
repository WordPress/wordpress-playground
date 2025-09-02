// smtp-sink.ts — browser SMTP receiver with AUTH + STARTTLS policy toggles

// Isomorphic EventEmitter interface using EventTarget
// Defines the events that SmtpSink can emit
export interface SmtpSinkEvents {
	'email-sent': CustomEvent<CaughtMessage>;
}

export type ByteDuplex = {
	readable: ReadableStream<Uint8Array>;
	writable: WritableStream<Uint8Array>;
};

export type CaughtMessage = {
	id: string;
	receivedAt: string;
	from: string;
	to: string;
	subject: string;
	headers: Record<string, string>;
	text?: string;
	raw: string;
	rawSize: number;
};

type State = 'greeting' | 'idle' | 'mail' | 'rcpt' | 'data';
type SaslMech = 'PLAIN' | 'LOGIN';
type TlsMode = 'omit' | 'advertise_454' | 'reject_502';

export type AuthValidator = (
	mech: SaslMech,
	cred: { username: string; password: string }
) => boolean | Promise<boolean>;

export type SmtpSinkOptions = {
	maxSize?: number;
	tls?: { mode?: TlsMode }; // "omit" = don't advertise; "advertise_454" = advertise STARTTLS but 454 on command; "reject_502" = don't advertise, 502 on STARTTLS
	auth?: {
		mechs?: SaslMech[]; // which mechanisms to offer
		advertise?: boolean; // show AUTH on EHLO
		requireAuth?: boolean; // 530 before MAIL/RCPT unless authenticated
		requireTlsForAuth?: boolean; // 530 on AUTH until STARTTLS (you will never satisfy it here, but it signals intent)
		validator?: AuthValidator; // check creds; default accepts anything
	};
};

/**
 * SMTP server sink that receives emails and emits events.
 * Extends EventTarget to provide isomorphic event emitter functionality.
 *
 * Events emitted:
 * - 'email-sent': Fired when a complete email is successfully received
 */
export class SmtpSink extends EventTarget {
	private enc = new TextEncoder();
	private dec = new TextDecoder('utf-8', { fatal: false });
	private lineBuf = '';
	private dataMode = false;
	private dataLines: string[] = [];
	private state: State = 'greeting';
	private mailFrom: string | null = null;
	private rcpts: string[] = [];
	private writer: WritableStreamDefaultWriter<Uint8Array>;
	private reader: ReadableStreamDefaultReader<Uint8Array>;
	private closed = false;
	private readonly maxSize: number;

	// sequencing so replies stay in order
	private seq: Promise<void> = Promise.resolve();

	// TLS + AUTH policy
	private tlsMode: TlsMode;
	private authAdvertise: boolean;
	private authMechs: SaslMech[];
	private authRequire: boolean;
	private authRequireTls: boolean;
	private authValidator: AuthValidator;
	private authenticated = false;
	private authPending = false;
	private authState:
		| { mech: 'PLAIN'; stage: 'waitInitial' }
		| { mech: 'LOGIN'; stage: 'username' | 'password'; username?: string }
		| null = null;

	constructor(
		private duplex: ByteDuplex,
		private onMessage: (m: CaughtMessage) => void,
		opts: SmtpSinkOptions = {}
	) {
		super();
		this.writer = duplex.writable.getWriter();
		this.reader = duplex.readable.getReader();
		this.maxSize = opts.maxSize ?? 10 * 1024 * 1024;

		this.tlsMode = opts.tls?.mode ?? 'omit';
		this.authMechs = opts.auth?.mechs ?? [];
		this.authAdvertise = opts.auth?.advertise ?? this.authMechs.length > 0;
		this.authRequire = opts.auth?.requireAuth ?? false;
		this.authRequireTls = opts.auth?.requireTlsForAuth ?? false;
		this.authValidator = opts.auth?.validator ?? (async () => true);
	}

	async start(): Promise<void> {
		await this.reply(220, 'localhost ESMTP ready');
		for (;;) {
			const r = await this.reader.read();
			if (r.done) break;
			this.consumeChunk(r.value);
			if (this.closed) break;
		}
		try {
			await this.writer.close();
		} catch {}
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
	}

	private enqueue(fn: () => Promise<void>) {
		this.seq = this.seq.then(fn).catch(() => {});
	}

	private async handleCommand(rawLine: string) {
		const line = rawLine.trimEnd();
		const sp = line.indexOf(' ');
		const cmd = (sp < 0 ? line : line.slice(0, sp)).toUpperCase();
		const arg = sp < 0 ? '' : line.slice(sp + 1);

		switch (cmd) {
			case 'EHLO':
			case 'HELO': {
				this.state = 'idle';
				const ext: string[] = [];
				if (this.tlsMode === 'advertise_454') ext.push('STARTTLS');
				if (this.authAdvertise && this.authMechs.length) {
					const list = this.authMechs.join(' ');
					ext.push(`AUTH ${list}`, `AUTH=${list}`);
				}
				ext.push(`SIZE ${this.maxSize}`, 'PIPELINING');
				await this.replyMulti(250, [
					`Hello ${arg || 'client'}`,
					...ext,
				]);
				break;
			}

			case 'STARTTLS': {
				if (this.tlsMode === 'advertise_454') {
					await this.reply(454, 'TLS not available');
				} else if (
					this.tlsMode === 'reject_502' ||
					this.tlsMode === 'omit'
				) {
					await this.reply(502, 'Command not implemented');
				}
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

				if (this.authRequireTls && this.tlsMode !== 'omit') {
					// we require TLS first; we can't actually upgrade, so be explicit
					await this.reply(
						530,
						'Must issue a STARTTLS command first'
					);
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
						await this.reply334(''); // empty challenge
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
						await this.reply334(b64('Password:'));
					} else {
						this.authPending = true;
						this.authState = { mech: 'LOGIN', stage: 'username' };
						await this.reply334(b64('Username:'));
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
				if (!/^FROM:/i.test(arg)) {
					await this.reply(501, 'syntax: MAIL FROM:<addr>');
					break;
				}
				this.mailFrom = this.extractPath(arg.slice(5));
				this.rcpts = [];
				this.state = 'mail';
				await this.reply(250, 'OK');
				break;
			}

			case 'RCPT': {
				if (this.authRequire && !this.authenticated) {
					await this.reply(530, 'Authentication required');
					break;
				}
				if (!/^TO:/i.test(arg)) {
					await this.reply(501, 'syntax: RCPT TO:<addr>');
					break;
				}
				if (!this.mailFrom) {
					await this.reply(503, 'need MAIL FROM first');
					break;
				}
				this.rcpts.push(this.extractPath(arg.slice(3)));
				this.state = 'rcpt';
				await this.reply(250, 'Accepted');
				break;
			}

			case 'DATA': {
				if (!this.mailFrom || this.rcpts.length === 0) {
					await this.reply(503, 'need MAIL/RCPT first');
					break;
				}
				await this.reply(354, 'End data with <CR><LF>.<CR><LF>');
				this.dataMode = true;
				this.dataLines = [];
				this.state = 'data';
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
				this.closed = true;
				try {
					await this.writer.close();
				} catch {}
				break;

			default:
				await this.reply(502, 'command not implemented');
				break;
		}
	}

	private async handleDataLine(line: string) {
		if (line === '.') {
			this.dataMode = false;
			const bodyStr = this.dataLines.join('\r\n') + '\r\n';
			const bytes = this.enc.encode(bodyStr);
			if (bytes.byteLength > this.maxSize) {
				await this.reply(552, 'message size exceeds fixed limit');
				this.resetEnvelope();
				return;
			}
			const id = this.makeId();
			const raw = bodyStr;
			const { headers, subject, text, from, to } = parseEmail(
				raw,
				this.mailFrom ?? '',
				this.rcpts
			);
			const message: CaughtMessage = {
				id,
				receivedAt: new Date().toISOString(),
				from,
				to,
				subject,
				headers,
				text,
				raw,
				rawSize: bytes.byteLength,
			};

			// Call the original callback
			this.onMessage(message);

			// Emit the email-sent event
			this.dispatchEvent(
				new CustomEvent('email-sent', { detail: message })
			);

			await this.reply(250, `Queued as ${id}`);
			this.resetEnvelope();
			return;
		}

		const actual = line.startsWith('..') ? line.slice(1) : line;
		this.dataLines.push(actual);

		if (this.dataLines.length % 128 === 0) {
			const bytes = this.enc.encode(this.dataLines.join('\r\n'));
			if (bytes.byteLength > this.maxSize) {
				await this.reply(552, 'message size exceeds fixed limit');
				this.dataMode = false;
				this.resetEnvelope();
			}
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
				await this.reply334(b64('Password:'));
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

	private extractPath(rest: string): string {
		const m = rest.match(/<([^>]+)>/);
		return (m ? m[1] : rest).trim();
	}

	private resetEnvelope() {
		this.mailFrom = null;
		this.rcpts = [];
		this.state = 'idle';
		this.dataMode = false;
		this.dataLines = [];
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
	private async reply334(challengeB64: string) {
		// RFC 4954 style: "334 <challenge>"
		await this.writer.write(this.enc.encode(`334 ${challengeB64}\r\n`));
	}
	private makeId(): string {
		return `${Date.now().toString(36)}-${Math.random()
			.toString(36)
			.slice(2, 8)}`;
	}
}

/* ---------- Helpers: MIME parsing (unchanged from earlier) ---------- */

function unfoldHeaders(hdr: string): string {
	return hdr.replace(/\r\n([ \t]+)/g, ' ');
}
function splitHeaderBody(raw: string): { headerRaw: string; bodyRaw: string } {
	const idx = raw.indexOf('\r\n\r\n');
	if (idx < 0) return { headerRaw: raw, bodyRaw: '' };
	return { headerRaw: raw.slice(0, idx), bodyRaw: raw.slice(idx + 4) };
}
function parseHeaderLines(headerRaw: string): Record<string, string> {
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
	let parts: string[] = [];
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
export function parseEmail(
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

/* ---------- Transport adapters & loopback ---------- */

export function duplexFromWebSocket(ws: WebSocket): ByteDuplex {
	const readable = new ReadableStream<Uint8Array>({
		start(controller) {
			ws.binaryType = 'arraybuffer';
			const onMsg = (e: MessageEvent) => {
				if (typeof e.data === 'string')
					controller.enqueue(new TextEncoder().encode(e.data));
				else if (e.data instanceof ArrayBuffer)
					controller.enqueue(new Uint8Array(e.data));
				else if (e.data instanceof Blob)
					e.data
						.arrayBuffer()
						.then((b) => controller.enqueue(new Uint8Array(b)));
			};
			ws.addEventListener('message', onMsg);
			ws.addEventListener('close', () => controller.close());
			ws.addEventListener('error', (err: Event) => controller.error(err));
		},
	});
	const writable = new WritableStream<Uint8Array>({
		write(chunk) {
			ws.send(chunk);
		},
		close() {
			try {
				ws.close();
			} catch {}
		},
		abort() {
			try {
				ws.close();
			} catch {}
		},
	});
	return { readable, writable };
}

export function duplexFromWebTransportStream(stream: {
	readable: ReadableStream<Uint8Array>;
	writable: WritableStream<Uint8Array>;
}): ByteDuplex {
	return { readable: stream.readable, writable: stream.writable };
}

export function makeLoopbackPair(): [ByteDuplex, ByteDuplex] {
	const a2b = new TransformStream<Uint8Array, Uint8Array>();
	const b2a = new TransformStream<Uint8Array, Uint8Array>();
	const a: ByteDuplex = { readable: b2a.readable, writable: a2b.writable };
	const b: ByteDuplex = { readable: a2b.readable, writable: b2a.writable };
	return [a, b];
}

/* ---------- small utils ---------- */
function normalizeInitial(x?: string): string | null {
	if (!x) return null;
	const t = x.trim();
	if (t === '' || t === '=') return null;
	return t;
}
