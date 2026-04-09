import { describe, it, expect } from 'vitest';
import {
	SmtpSink,
	makeLoopbackPair,
	parseEmail,
	type CaughtMessage,
	type SmtpSinkOptions,
} from './smtp';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Spins up a fake SMTP server (the "sink") connected to an in-memory
 * client via a loopback byte stream. Returns helpers that let tests
 * act as an SMTP client: send commands, read responses, and inspect
 * captured emails.
 *
 * - `messages` collects every email the sink accepted.
 * - The sink starts listening immediately.
 */
function createClient(opts?: SmtpSinkOptions) {
	const [duplexClient, duplexServer] = makeLoopbackPair();
	const messages: CaughtMessage[] = [];
	const sink = new SmtpSink(
		duplexServer,
		(m: CaughtMessage) => messages.push(m),
		opts
	);
	void sink.start();
	const writer = duplexClient.writable.getWriter();
	const reader = duplexClient.readable.getReader();

	/** Read the next chunk the server sent (e.g. a response line). */
	async function read(): Promise<string> {
		const { value } = await reader.read();
		return value ? dec.decode(value) : '';
	}

	/** Send raw bytes to the server (no CRLF added). */
	async function write(s: string) {
		await writer.write(enc.encode(s));
	}

	return {
		read,
		write,
		messages,
		sink,
	};
}

/** Run a full EHLO handshake, consuming multi-line responses. */
async function ehlo(
	client: ReturnType<typeof createClient>,
	hostname = 'localhost'
): Promise<string[]> {
	await client.write(`EHLO ${hostname}\r\n`);
	const lines: string[] = [];
	for (;;) {
		const resp = await client.read();
		lines.push(resp);
		if (/^250 /m.test(resp)) break;
		if (!/^250-/m.test(resp))
			throw new Error(`Unexpected EHLO response: ${resp}`);
	}
	return lines;
}

/* ================================================================== */
/*  Happy-path test (existing)                                        */
/* ================================================================== */

describe('SmtpSink – happy path', () => {
	it('captures an email and emits email-sent event', async () => {
		const client = createClient();
		const greeting = await client.read();
		expect(greeting).toMatch(/^220 /);

		// HELO
		await client.write('HELO localhost\r\n');
		let helo = await client.read();
		while (/^250-/.test(helo)) helo = await client.read();
		expect(helo).toMatch(/^250 /);

		// MAIL FROM
		await client.write('MAIL FROM: <test@localhost>\r\n');
		expect(await client.read()).toMatch(/^250 /);

		// RCPT TO
		await client.write('RCPT TO: <test2@localhost>\r\n');
		expect(await client.read()).toMatch(/^250 /);

		// DATA
		await client.write('DATA\r\n');
		expect(await client.read()).toMatch(/^354 /);

		await client.write('Subject: Test Email\r\n');
		await client.write('From: test@localhost\r\n');
		await client.write('To: test2@localhost\r\n');
		await client.write('\r\n');
		await client.write('This is the email body content.\r\n');
		await client.write('.\r\n');
		expect(await client.read()).toMatch(/^250 /);

		// QUIT
		await client.write('QUIT\r\n');
		expect(await client.read()).toMatch(/^221 /);

		expect(client.messages).toHaveLength(1);
		const msg = client.messages[0];
		expect(msg.subject).toBe('Test Email');
		expect(msg.from).toContain('test@localhost');
		expect(msg.to).toContain('test2@localhost');
		expect((msg.text ?? '').trim()).toBe('This is the email body content.');
	});
});

/* ================================================================== */
/*  EHLO extensions                                                   */
/* ================================================================== */

describe('SmtpSink – EHLO', () => {
	it('advertises SIZE and PIPELINING', async () => {
		const client = createClient();
		await client.read();
		const lines = await ehlo(client);
		const joined = lines.join('\n');
		expect(joined).toMatch(/SIZE/);
		expect(joined).toMatch(/PIPELINING/);
	});

	it('advertises AUTH when mechs are configured', async () => {
		const client = createClient({
			auth: { mechs: ['PLAIN', 'LOGIN'] },
		});
		await client.read();
		const lines = await ehlo(client);
		const joined = lines.join('\n');
		expect(joined).toMatch(/AUTH PLAIN LOGIN/);
	});

	it('advertises STARTTLS in advertise_454 mode', async () => {
		const client = createClient({
			tls: { mode: 'advertise_454' },
		});
		await client.read();
		const lines = await ehlo(client);
		const joined = lines.join('\n');
		expect(joined).toMatch(/STARTTLS/);
	});
});

/* ================================================================== */
/*  STARTTLS                                                          */
/* ================================================================== */

describe('SmtpSink – STARTTLS', () => {
	it('returns 454 in advertise_454 mode', async () => {
		const client = createClient({
			tls: { mode: 'advertise_454' },
		});
		await client.read();
		await ehlo(client);
		await client.write('STARTTLS\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^454 /);
	});

	it('returns 502 in reject_502 mode', async () => {
		const client = createClient({
			tls: { mode: 'reject_502' },
		});
		await client.read();
		await ehlo(client);
		await client.write('STARTTLS\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^502 /);
	});

	it('does not advertise STARTTLS in omit mode', async () => {
		const client = createClient({ tls: { mode: 'omit' } });
		await client.read();
		const lines = await ehlo(client);
		const joined = lines.join('\n');
		expect(joined).not.toMatch(/STARTTLS/);
	});
});

/* ================================================================== */
/*  AUTH PLAIN                                                        */
/* ================================================================== */

describe('SmtpSink – AUTH PLAIN', () => {
	it('accepts valid credentials inline', async () => {
		const client = createClient({
			auth: { mechs: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		// PLAIN: \0username\0password in base64
		const creds = btoa('\0user\0pass');
		await client.write(`AUTH PLAIN ${creds}\r\n`);
		const resp = await client.read();
		expect(resp).toMatch(/^235 /);
	});

	it('accepts valid credentials via challenge-response', async () => {
		const client = createClient({
			auth: { mechs: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write('AUTH PLAIN\r\n');
		const challenge = await client.read();
		expect(challenge).toMatch(/^334 /);
		const creds = btoa('\0user\0pass');
		await client.write(`${creds}\r\n`);
		const resp = await client.read();
		expect(resp).toMatch(/^235 /);
	});

	it('rejects invalid credentials', async () => {
		const client = createClient({
			auth: {
				mechs: ['PLAIN'],
				validator: async (_mech, { username, password }) =>
					username === 'admin' && password === 'secret',
			},
		});
		await client.read();
		await ehlo(client);
		const creds = btoa('\0wrong\0creds');
		await client.write(`AUTH PLAIN ${creds}\r\n`);
		const resp = await client.read();
		expect(resp).toMatch(/^535 /);
	});

	it('allows cancellation with *', async () => {
		const client = createClient({
			auth: { mechs: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write('AUTH PLAIN\r\n');
		await client.read();
		await client.write('*\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^501 /);
	});
});

/* ================================================================== */
/*  AUTH LOGIN                                                        */
/* ================================================================== */

describe('SmtpSink – AUTH LOGIN', () => {
	it('completes multi-step LOGIN flow', async () => {
		const client = createClient({
			auth: { mechs: ['LOGIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write('AUTH LOGIN\r\n');
		const usernameChallenge = await client.read();
		expect(usernameChallenge).toMatch(/^334 /);
		await client.write(`${btoa('myuser')}\r\n`);
		const passwordChallenge = await client.read();
		expect(passwordChallenge).toMatch(/^334 /);
		await client.write(`${btoa('mypass')}\r\n`);
		const resp = await client.read();
		expect(resp).toMatch(/^235 /);
	});

	it('accepts initial-response as username', async () => {
		const client = createClient({
			auth: { mechs: ['LOGIN'] },
		});
		await client.read();
		await ehlo(client);
		// Provide username inline
		await client.write(`AUTH LOGIN ${btoa('myuser')}\r\n`);
		const passwordChallenge = await client.read();
		expect(passwordChallenge).toMatch(/^334 /);
		await client.write(`${btoa('mypass')}\r\n`);
		const resp = await client.read();
		expect(resp).toMatch(/^235 /);
	});

	it('rejects invalid LOGIN credentials', async () => {
		const client = createClient({
			auth: {
				mechs: ['LOGIN'],
				validator: async () => false,
			},
		});
		await client.read();
		await ehlo(client);
		await client.write('AUTH LOGIN\r\n');
		await client.read();
		await client.write(`${btoa('user')}\r\n`);
		await client.read();
		await client.write(`${btoa('wrong')}\r\n`);
		const resp = await client.read();
		expect(resp).toMatch(/^535 /);
	});
});

/* ================================================================== */
/*  AUTH edge cases                                                   */
/* ================================================================== */

describe('SmtpSink – AUTH edge cases', () => {
	it('rejects AUTH with no mechanism', async () => {
		const client = createClient({
			auth: { mechs: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write('AUTH\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^501 /);
	});

	it('rejects already-authenticated client', async () => {
		const client = createClient({
			auth: { mechs: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		const creds = btoa('\0u\0p');
		await client.write(`AUTH PLAIN ${creds}\r\n`);
		await client.read();
		await client.write(`AUTH PLAIN ${creds}\r\n`);
		const resp = await client.read();
		expect(resp).toMatch(/^503 /);
	});

	it('rejects unrecognized auth mechanism', async () => {
		const client = createClient({
			auth: { mechs: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write('AUTH CRAM-MD5\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^504 /);
	});

	it('requires TLS before AUTH when requireTlsForAuth is set', async () => {
		const client = createClient({
			tls: { mode: 'advertise_454' },
			auth: { mechs: ['PLAIN'], requireTlsForAuth: true },
		});
		await client.read();
		await ehlo(client);
		const creds = btoa('\0u\0p');
		await client.write(`AUTH PLAIN ${creds}\r\n`);
		const resp = await client.read();
		expect(resp).toMatch(/^530 /);
	});

	it('rejects MAIL/RCPT when requireAuth and not authenticated', async () => {
		const client = createClient({
			auth: { mechs: ['PLAIN'], requireAuth: true },
		});
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM: <a@b.com>\r\n');
		const mailResp = await client.read();
		expect(mailResp).toMatch(/^530 /);
		await client.write('RCPT TO: <c@d.com>\r\n');
		const rcptResp = await client.read();
		expect(rcptResp).toMatch(/^530 /);
	});
});

/* ================================================================== */
/*  SMTP command edge cases                                           */
/* ================================================================== */

describe('SmtpSink – command edge cases', () => {
	it('RSET clears the envelope', async () => {
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM: <a@b.com>\r\n');
		await client.read();
		await client.write('RSET\r\n');
		const rsetResp = await client.read();
		expect(rsetResp).toMatch(/^250 /);
		// RCPT should now fail because envelope was reset
		await client.write('RCPT TO: <c@d.com>\r\n');
		const rcptResp = await client.read();
		expect(rcptResp).toMatch(/^503 /);
	});

	it('NOOP returns 250', async () => {
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('NOOP\r\n');
		expect(await client.read()).toMatch(/^250 /);
	});

	it('VRFY returns 252', async () => {
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('VRFY user\r\n');
		expect(await client.read()).toMatch(/^252 /);
	});

	it('unknown command returns 500', async () => {
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('XYZZY\r\n');
		expect(await client.read()).toMatch(/^500 /);
	});

	it.each(['EXPN', 'HELP', 'TURN'])(
		'recognized but unimplemented command %s returns 502',
		async (cmd) => {
			const client = createClient();
			await client.read();
			await ehlo(client);
			await client.write(`${cmd}\r\n`);
			expect(await client.read()).toMatch(/^502 /);
		}
	);

	it('rejects MAIL FROM with bad syntax', async () => {
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL TO: <a@b.com>\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^501 /);
	});

	it('rejects RCPT TO with bad syntax', async () => {
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('RCPT FROM: <a@b.com>\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^501 /);
	});

	it('rejects RCPT before MAIL', async () => {
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('RCPT TO: <a@b.com>\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^503 /);
	});

	it('rejects DATA before MAIL/RCPT', async () => {
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('DATA\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^503 /);
	});

	it('QUIT returns 221 and closes', async () => {
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('QUIT\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^221 /);
	});
});

/* ================================================================== */
/*  Data handling                                                     */
/* ================================================================== */

describe('SmtpSink – data handling', () => {
	it('handles dot-stuffing (lines starting with ..)', async () => {
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM: <a@b.com>\r\n');
		await client.read();
		await client.write('RCPT TO: <c@d.com>\r\n');
		await client.read();
		await client.write('DATA\r\n');
		await client.read();
		await client.write('Subject: Dots\r\n');
		await client.write('\r\n');
		// A line that starts with a dot must be dot-stuffed by the client
		await client.write('..This line started with a dot.\r\n');
		await client.write('Normal line.\r\n');
		await client.write('.\r\n');
		await client.read(); // 250 Queued

		expect(client.messages).toHaveLength(1);
		expect(client.messages[0].text).toContain(
			'.This line started with a dot.'
		);
		expect(client.messages[0].text).toContain('Normal line.');
	});

	it('rejects message exceeding maxSize', async () => {
		const client = createClient({ maxSize: 100 });
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM: <a@b.com>\r\n');
		await client.read();
		await client.write('RCPT TO: <c@d.com>\r\n');
		await client.read();
		await client.write('DATA\r\n');
		await client.read();
		await client.write('Subject: Big\r\n');
		await client.write('\r\n');
		// Send data larger than 100 bytes
		await client.write('X'.repeat(200) + '\r\n');
		await client.write('.\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^552 /);
		expect(client.messages).toHaveLength(0);
	});

	it('sends multiple emails in one session', async () => {
		const client = createClient();
		await client.read();
		await ehlo(client);

		await client.write('MAIL FROM: <s@test.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('RCPT TO: <a@test.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('DATA\r\n');
		expect(await client.read()).toMatch(/^354 /);
		await client.write('Subject: First\r\n\r\nBody 1\r\n.\r\n');
		expect(await client.read()).toMatch(/^250 /);

		await client.write('MAIL FROM: <s@test.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('RCPT TO: <b@test.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('DATA\r\n');
		expect(await client.read()).toMatch(/^354 /);
		await client.write('Subject: Second\r\n\r\nBody 2\r\n.\r\n');
		expect(await client.read()).toMatch(/^250 /);

		expect(client.messages).toHaveLength(2);
		expect(client.messages[0].subject).toBe('First');
		expect(client.messages[1].subject).toBe('Second');
	});
});

/* ================================================================== */
/*  parseEmail – MIME parsing                                         */
/* ================================================================== */

describe('parseEmail', () => {
	it('parses a simple text/plain email', () => {
		const raw =
			'Subject: Hello\r\n' +
			'From: a@b.com\r\n' +
			'To: c@d.com\r\n' +
			'\r\n' +
			'Body text here.\r\n';
		const result = parseEmail(raw, 'fallback@x.com', ['fb@y.com']);
		expect(result.subject).toBe('Hello');
		expect(result.from).toBe('a@b.com');
		expect(result.to).toBe('c@d.com');
		expect(result.text?.trim()).toBe('Body text here.');
	});

	it('uses fallback from/to when headers are missing', () => {
		const raw = 'Subject: No addrs\r\n\r\nBody.\r\n';
		const result = parseEmail(raw, 'env@from.com', [
			'env@to1.com',
			'env@to2.com',
		]);
		expect(result.from).toBe('env@from.com');
		expect(result.to).toBe('env@to1.com, env@to2.com');
	});

	it('shows (no subject) when Subject header is missing', () => {
		const raw = 'From: a@b.com\r\n\r\nBody.\r\n';
		const result = parseEmail(raw, '', []);
		expect(result.subject).toBe('(no subject)');
	});

	it('decodes RFC 2047 base64 encoded subject', () => {
		// "Test" in base64
		const encoded = '=?utf-8?B?VGVzdA==?=';
		const raw = `Subject: ${encoded}\r\n\r\nBody.\r\n`;
		const result = parseEmail(raw, '', []);
		expect(result.subject).toBe('Test');
	});

	it('decodes RFC 2047 Q-encoded subject', () => {
		// "Hello World" Q-encoded (underscore = space)
		const encoded = '=?utf-8?Q?Hello_World?=';
		const raw = `Subject: ${encoded}\r\n\r\nBody.\r\n`;
		const result = parseEmail(raw, '', []);
		expect(result.subject).toBe('Hello World');
	});

	it('decodes quoted-printable body', () => {
		const raw =
			'Subject: QP\r\n' +
			'Content-Type: text/plain; charset=utf-8\r\n' +
			'Content-Transfer-Encoding: quoted-printable\r\n' +
			'\r\n' +
			'Hello =C3=A9 world\r\n';
		const result = parseEmail(raw, '', []);
		expect(result.text).toContain('Hello é world');
	});

	it('decodes base64 body', () => {
		const raw =
			'Subject: B64\r\n' +
			'Content-Type: text/plain; charset=utf-8\r\n' +
			'Content-Transfer-Encoding: base64\r\n' +
			'\r\n' +
			btoa('Decoded body content') +
			'\r\n';
		const result = parseEmail(raw, '', []);
		expect(result.text?.trim()).toBe('Decoded body content');
	});

	it('extracts text/plain from multipart email', () => {
		const boundary = 'BOUNDARY123';
		const raw =
			`Subject: Multi\r\n` +
			`Content-Type: multipart/alternative; boundary="${boundary}"\r\n` +
			`\r\n` +
			`--${boundary}\r\n` +
			`Content-Type: text/plain; charset=utf-8\r\n` +
			`\r\n` +
			`Plain text part.\r\n` +
			`--${boundary}\r\n` +
			`Content-Type: text/html; charset=utf-8\r\n` +
			`\r\n` +
			`<p>HTML part.</p>\r\n` +
			`--${boundary}--\r\n`;
		const result = parseEmail(raw, '', []);
		expect(result.subject).toBe('Multi');
		expect(result.text?.trim()).toBe('Plain text part.');
	});

	it('handles folded headers', () => {
		const raw =
			'Subject: This is a very long\r\n' +
			' subject line that was folded\r\n' +
			'From: a@b.com\r\n' +
			'\r\n' +
			'Body.\r\n';
		const result = parseEmail(raw, '', []);
		expect(result.subject).toBe(
			'This is a very long subject line that was folded'
		);
	});

	it('handles email with no body', () => {
		const raw = 'Subject: Empty\r\nFrom: a@b.com\r\n';
		const result = parseEmail(raw, '', []);
		expect(result.subject).toBe('Empty');
		// No \r\n\r\n separator means bodyRaw is ''
		expect(result.text).toBe('');
	});
});
