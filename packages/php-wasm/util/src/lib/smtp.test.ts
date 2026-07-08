import { describe, it, expect } from 'vitest';
import {
	SmtpSink,
	makeLoopbackPair,
	parseMessage,
	type CaughtMessage,
	type SmtpSinkOptions,
} from './smtp';
import { encodeUint8ArrayAsBase64 } from './base64';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Spins up a fake SMTP server (the "sink") connected to an in-memory
 * client via a loopback byte stream. Returns helpers that let tests
 * act as an SMTP client: send commands, read responses, and inspect
 * captured emails.
 *
 * - `messages` collects every email the sink accepted.
 * - The sink starts listening immediately.
 */
function createClient(options?: SmtpSinkOptions) {
	const [duplexClient, duplexServer] = makeLoopbackPair();
	const messages: CaughtMessage[] = [];
	const sink = new SmtpSink(
		duplexServer,
		(message: CaughtMessage) => messages.push(message),
		options
	);
	void sink.start();
	const writer = duplexClient.writable.getWriter();
	const reader = duplexClient.readable.getReader();

	/** Read the next chunk the server sent (e.g. a response line). */
	async function read(): Promise<string> {
		const { value } = await reader.read();
		return value ? decoder.decode(value) : '';
	}

	/** Send raw bytes to the server (no CRLF added). */
	async function write(s: string) {
		await writer.write(encoder.encode(s));
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
	while (true) {
		const resp = await client.read();
		lines.push(resp);
		if (/^250 /m.test(resp)) break;
		if (!/^250-/m.test(resp))
			throw new Error(`Unexpected EHLO response: ${resp}`);
	}
	return lines;
}

function getServerDomainFromGreeting(greeting: string): string {
	const match = greeting.match(/^220 ([^\s]+)(?:\s|\r\n|$)/);
	if (!match) {
		throw new Error(`Unexpected SMTP greeting: ${greeting}`);
	}
	return match[1];
}

function escapeForRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('SmtpSink – happy path', () => {
	it('captures an email through a full SMTP transaction', async () => {
		// Walks the canonical SMTP transaction from RFC 5321 §3.3:
		// 220 greeting → HELO → MAIL FROM → RCPT TO → DATA (354) →
		// body terminated by ".<CRLF>" (250 queued) → QUIT (221).
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-3.3
		const client = createClient();
		const greeting = await client.read();
		expect(greeting).toMatch(/^220 /);

		await client.write('HELO localhost\r\n');
		let helo = await client.read();
		while (/^250-/.test(helo)) helo = await client.read();
		expect(helo).toMatch(/^250 /);

		await client.write('MAIL FROM:<test@localhost>\r\n');
		expect(await client.read()).toMatch(/^250 /);

		await client.write('RCPT TO:<test2@localhost>\r\n');
		expect(await client.read()).toMatch(/^250 /);

		await client.write('DATA\r\n');
		expect(await client.read()).toBe(
			'354 Start mail input; end with <CRLF>.<CRLF>\r\n'
		);

		await client.write('Subject: Test Email\r\n');
		await client.write('From: test@localhost\r\n');
		await client.write('To: test2@localhost\r\n');
		await client.write('\r\n');
		await client.write('This is the email body content.\r\n');
		await client.write('.\r\n');
		expect(await client.read()).toMatch(/^250 /);

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

describe('SmtpSink – EHLO', () => {
	it('advertises SIZE and PIPELINING', async () => {
		// RFC 1870 §3 (SIZE) and RFC 2920 §3 (PIPELINING) ESMTP keywords.
		// References:
		// - https://www.rfc-editor.org/rfc/rfc1870.html#section-3
		// - https://www.rfc-editor.org/rfc/rfc2920.html#section-3
		const client = createClient();
		await client.read();
		const lines = await ehlo(client);
		const joined = lines.join('\n');
		expect(joined).toMatch(/SIZE/);
		expect(joined).toMatch(/PIPELINING/);
	});

	it('advertises AUTH when mechanisms are configured', async () => {
		// RFC 4954 §3: the AUTH EHLO keyword is advertised with a
		// space-separated list of available SASL mechanism names as
		// its parameter.
		// Reference: https://www.rfc-editor.org/rfc/rfc4954.html#section-3
		const client = createClient({
			auth: { mechanisms: ['PLAIN', 'LOGIN'] },
		});
		await client.read();
		const lines = await ehlo(client);
		const joined = lines.join('\n');
		expect(joined).toMatch(/AUTH PLAIN LOGIN/);
	});

	it('does not advertise STARTTLS', async () => {
		// The sink runs over an in-process loopback duplex with
		// nothing to encrypt, so STARTTLS is never offered. Clients
		// that need TLS must be configured for plain SMTP.
		const client = createClient();
		await client.read();
		const lines = await ehlo(client);
		const joined = lines.join('\n');
		expect(joined).not.toMatch(/STARTTLS/);
	});

	it('HELO returns a single-line greeting with no extension lines', async () => {
		// RFC 5321 §4.1.1.1: HELO is the legacy non-extended greeting,
		// so it must NOT advertise ESMTP extensions.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.1
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
		});
		await client.read();
		await client.write('HELO localhost\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^250 /);
		expect(resp).not.toMatch(/^250-/m);
		expect(resp).not.toMatch(/AUTH/);
		expect(resp).not.toMatch(/SIZE/);
		expect(resp).not.toMatch(/PIPELINING/);
	});

	it('rejects EHLO with no domain argument', async () => {
		// RFC 5321 §4.1.1.1 ABNF:
		//   ehlo = "EHLO" SP ( Domain / address-literal ) CRLF
		// The Domain (or address-literal) is a required production,
		// so a bare "EHLO\r\n" is a syntax error.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.1
		const client = createClient();
		await client.read();
		await client.write('EHLO\r\n');
		expect(await client.read()).toMatch(/^501 /);
	});

	it('rejects HELO with no domain argument', async () => {
		// RFC 5321 §4.1.1.1 ABNF:
		//   helo = "HELO" SP Domain CRLF
		// Domain is mandatory; a bare "HELO\r\n" is a syntax error.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.1
		const client = createClient();
		await client.read();
		await client.write('HELO\r\n');
		expect(await client.read()).toMatch(/^501 /);
	});

	it('EHLO greeting line starts with the server domain, not free-form text', async () => {
		// RFC 5321 §4.1.1.1 ABNF:
		//   ehlo-ok-rsp = "250-" Domain [ SP ehlo-greet ] CRLF
		//                 *( "250-" ehlo-line CRLF )
		//                 "250" SP ehlo-line CRLF
		// The first token after "250-" MUST be the server's Domain;
		// any free-form `ehlo-greet` follows after a single SP.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.1
		const client = createClient();
		const greeting = await client.read();
		const serverDomain = getServerDomainFromGreeting(greeting);
		await client.write('EHLO client.example.com\r\n');
		const first = await client.read();
		// The first reply line is "250-<Domain>[ SP ehlo-greet]".
		// The domain token should match the 220 banner, not free-form text.
		expect(first).toMatch(
			new RegExp(`^250-${escapeForRegExp(serverDomain)}(\\s|\\r\\n)`)
		);
	});

	it('HELO greeting line starts with the server domain', async () => {
		// RFC 5321 §4.1.1.1 ABNF for HELO uses the same single-line
		// `"250" SP Domain [ SP ehlo-greet ]` shape.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.1
		const client = createClient();
		const greeting = await client.read();
		const serverDomain = getServerDomainFromGreeting(greeting);
		await client.write('HELO client.example.com\r\n');
		const resp = await client.read();
		expect(resp).toMatch(
			new RegExp(`^250 ${escapeForRegExp(serverDomain)}(\\s|\\r\\n)`)
		);
	});
});

describe('SmtpSink – STARTTLS', () => {
	it('refuses STARTTLS with 502', async () => {
		// RFC 5321 §4.2.4: an unimplemented command is answered with
		// 502. The sink never advertises STARTTLS in EHLO, so a
		// client that issues it anyway gets the unimplemented response.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.2.4
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('STARTTLS\r\n');
		const resp = await client.read();
		expect(resp).toBe('502 Command not implemented\r\n');
	});
});

describe('SmtpSink – AUTH PLAIN', () => {
	it('accepts valid credentials inline', async () => {
		// RFC 4954 §4 (initial-response form) + RFC 4616 §2 (PLAIN
		// SASL message: [authzid] UTF8NUL authcid UTF8NUL passwd).
		// Success returns 235.
		// References:
		// - https://www.rfc-editor.org/rfc/rfc4954.html#section-4
		// - https://www.rfc-editor.org/rfc/rfc4616.html#section-2
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		// PLAIN: \0username\0password in base64
		const credentials = btoa('\0user\0pass');
		await client.write(`AUTH PLAIN ${credentials}\r\n`);
		const resp = await client.read();
		expect(resp).toBe('235 2.7.0 Authentication Succeeded\r\n');
	});

	it('accepts valid credentials via challenge-response', async () => {
		// RFC 4954 §4: when no initial response is supplied, the server
		// issues "334 " with an empty challenge and the client follows
		// up with the SASL response on its own line.
		// Reference: https://www.rfc-editor.org/rfc/rfc4954.html#section-4
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write('AUTH PLAIN\r\n');
		const challenge = await client.read();
		expect(challenge).toMatch(/^334 /);
		const credentials = btoa('\0user\0pass');
		await client.write(`${credentials}\r\n`);
		const resp = await client.read();
		expect(resp).toBe('235 2.7.0 Authentication Succeeded\r\n');
	});

	it('accepts AUTH responses close to the 12288-octet limit', async () => {
		// RFC 4954 §4 allows AUTH client response lines up to 12288 octets,
		// including CRLF.
		// https://www.rfc-editor.org/rfc/rfc4954.html#section-4
		const authResponseLineLimit = 12288;
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write('AUTH PLAIN\r\n');
		expect(await client.read()).toMatch(/^334 /);
		const credentials = btoa(`\0${'u'.repeat(9207)}\0pass`);
		expect(credentials.length + 2).toBeLessThanOrEqual(
			authResponseLineLimit
		);
		expect(credentials.length + 2).toBeGreaterThan(
			authResponseLineLimit - 8
		);
		expect(credentials.length + 2).toBeGreaterThan(512);
		await client.write(`${credentials}\r\n`);
		const resp = await client.read();
		expect(resp).toBe('235 2.7.0 Authentication Succeeded\r\n');
	});

	it('rejects invalid PLAIN base64 with syntax error', async () => {
		// RFC 4954 §4: undecodable client responses reject AUTH with 501.
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write('AUTH PLAIN\r\n');
		await client.read();
		await client.write('!!!!\r\n');
		const resp = await client.read();
		expect(resp).toBe('501 Syntax error in parameters or arguments\r\n');
	});

	it('treats = as an empty initial response', async () => {
		// RFC 4954 §4: "=" is a zero-length initial response, not a
		// request for another 334 challenge. Empty PLAIN credentials are
		// invalid for this sink and should fail immediately.
		// Reference: https://www.rfc-editor.org/rfc/rfc4954.html#section-4
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write('AUTH PLAIN =\r\n');
		const resp = await client.read();
		expect(resp).toBe('535 5.7.8 Authentication credentials invalid\r\n');
	});

	it('rejects invalid credentials', async () => {
		// RFC 4954 §6: bad credentials produce "535 5.7.8
		// Authentication credentials invalid".
		// Reference: https://www.rfc-editor.org/rfc/rfc4954.html#section-6
		const client = createClient({
			auth: {
				mechanisms: ['PLAIN'],
				validator: async (_mechanism, { username, password }) =>
					username === 'admin' && password === 'secret',
			},
		});
		await client.read();
		await ehlo(client);
		const credentials = btoa('\0wrong\0creds');
		await client.write(`AUTH PLAIN ${credentials}\r\n`);
		const resp = await client.read();
		expect(resp).toBe('535 5.7.8 Authentication credentials invalid\r\n');
	});

	it('allows cancellation with *', async () => {
		// RFC 4954 §4: a single "*" sent in place of a SASL response
		// cancels the AUTH exchange; the server returns 501.
		// Reference: https://www.rfc-editor.org/rfc/rfc4954.html#section-4
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write('AUTH PLAIN\r\n');
		await client.read();
		await client.write('*\r\n');
		const resp = await client.read();
		expect(resp).toBe('501 5.7.0 Authentication canceled\r\n');
	});
});

describe('SmtpSink – AUTH LOGIN', () => {
	it('completes multi-step LOGIN flow', async () => {
		// LOGIN SASL is non-standard (draft-murchison-sasl-login) but
		// universally deployed: server prompts with base64("Username:")
		// then base64("Password:") via 334 challenges, then 235 on
		// success per RFC 4954 §4.
		// Reference: https://www.rfc-editor.org/rfc/rfc4954.html#section-4
		const client = createClient({
			auth: { mechanisms: ['LOGIN'] },
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
		expect(resp).toBe('235 2.7.0 Authentication Succeeded\r\n');
	});

	it('accepts initial-response as username', async () => {
		// RFC 4954 §4: clients may bundle the first SASL response onto
		// the AUTH command line. For LOGIN that response is the
		// username, so the server skips straight to the password
		// challenge.
		// Reference: https://www.rfc-editor.org/rfc/rfc4954.html#section-4
		const client = createClient({
			auth: { mechanisms: ['LOGIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write(`AUTH LOGIN ${btoa('myuser')}\r\n`);
		const passwordChallenge = await client.read();
		expect(passwordChallenge).toMatch(/^334 /);
		await client.write(`${btoa('mypass')}\r\n`);
		const resp = await client.read();
		expect(resp).toBe('235 2.7.0 Authentication Succeeded\r\n');
	});

	it('rejects invalid LOGIN credentials', async () => {
		// RFC 4954 §6: failed authentication exchange returns 535.
		// Reference: https://www.rfc-editor.org/rfc/rfc4954.html#section-6
		const client = createClient({
			auth: {
				mechanisms: ['LOGIN'],
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
		expect(resp).toBe('535 5.7.8 Authentication credentials invalid\r\n');
	});

	it('rejects invalid LOGIN base64 without hanging the session', async () => {
		// RFC 4954 §4: undecodable client responses reject AUTH with 501.
		const client = createClient({
			auth: { mechanisms: ['LOGIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write('AUTH LOGIN\r\n');
		await client.read();
		await client.write('!!!!\r\n');
		const resp = await client.read();
		expect(resp).toBe('501 Syntax error in parameters or arguments\r\n');
	});
});

describe('SmtpSink – AUTH edge cases', () => {
	it('rejects AUTH with no mechanism', async () => {
		// RFC 4954 §4: AUTH command requires a mechanism argument;
		// the server replies 501 on syntax errors.
		// Reference: https://www.rfc-editor.org/rfc/rfc4954.html#section-4
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write('AUTH\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^501 /);
	});

	it('rejects quoted AUTH mechanism tokens', async () => {
		// AUTH arguments follow SMTP ABNF, not shell argv quoting.
		// A quoted mechanism token is therefore a syntax error.
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write('AUTH "PLAIN"\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^501 /);
	});

	it('rejects AUTH with trailing extra tokens', async () => {
		// RFC 4954 §4 allows only `AUTH mechanism [initial-response]`.
		// Anything after the optional initial response is a syntax error.
		// Reference: https://www.rfc-editor.org/rfc/rfc4954.html#section-4
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		const credentials = btoa('\0user\0pass');
		await client.write(`AUTH PLAIN ${credentials} extra\r\n`);
		const resp = await client.read();
		expect(resp).toMatch(/^501 /);
	});

	it('rejects AUTH initial responses split across whitespace', async () => {
		// RFC 4954 §4 allows one optional initial-response token. Whitespace
		// inside the base64 data creates an extra token and is a syntax error.
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		const credentials = btoa('\0user\0pass');
		const splitCredentials = `${credentials.slice(0, 8)} ${credentials.slice(
			8
		)}`;
		await client.write(`AUTH PLAIN ${splitCredentials}\r\n`);
		const resp = await client.read();
		expect(resp).toBe('501 Syntax error in parameters or arguments\r\n');
	});

	it('rejects already-authenticated client', async () => {
		// RFC 4954 §4: after a successful AUTH, further AUTH commands
		// in the same session must be rejected with 503.
		// Reference: https://www.rfc-editor.org/rfc/rfc4954.html#section-4
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		const credentials = btoa('\0u\0p');
		await client.write(`AUTH PLAIN ${credentials}\r\n`);
		await client.read();
		await client.write(`AUTH PLAIN ${credentials}\r\n`);
		const resp = await client.read();
		expect(resp).toMatch(/^503 /);
	});

	it('rejects unrecognized auth mechanism', async () => {
		// RFC 4954 §4: a SASL mechanism the server doesn't support
		// produces "504 5.5.4 Unrecognized authentication type".
		// Reference: https://www.rfc-editor.org/rfc/rfc4954.html#section-4
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write('AUTH CRAM-MD5\r\n');
		const resp = await client.read();
		expect(resp).toBe('504 5.5.4 Unrecognized authentication type\r\n');
	});

	it('rejects MAIL/RCPT when requireAuth and not authenticated', async () => {
		// RFC 4954 §6: "530 5.7.0 Authentication required" SHOULD be
		// returned by any command other than AUTH/EHLO/HELO/NOOP/RSET/
		// QUIT when server policy requires authentication and the
		// session is not yet authenticated.
		// Reference: https://www.rfc-editor.org/rfc/rfc4954.html#section-6
		const client = createClient({
			auth: { mechanisms: ['PLAIN'], requireAuth: true },
		});
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		const mailResp = await client.read();
		expect(mailResp).toBe('530 5.7.0 Authentication required\r\n');
		await client.write('RCPT TO:<c@d.com>\r\n');
		const rcptResp = await client.read();
		expect(rcptResp).toBe('530 5.7.0 Authentication required\r\n');
	});

	it('rejects AUTH during an active mail transaction', async () => {
		// RFC 4954 §4: AUTH is not permitted during a mail transaction.
		// Reference: https://www.rfc-editor.org/rfc/rfc4954.html#section-4
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		await client.read();
		await client.write(`AUTH PLAIN ${btoa('\0u\0p')}\r\n`);
		const resp = await client.read();
		expect(resp).toBe('503 Bad sequence of commands\r\n');
	});
});

describe('SmtpSink – command edge cases', () => {
	it('RSET clears the envelope', async () => {
		// RFC 5321 §4.1.1.5: RSET aborts the current mail transaction
		// and clears reverse-path / forward-paths / mail data buffers,
		// then the server replies 250.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.5
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		await client.read();
		await client.write('RSET\r\n');
		const rsetResp = await client.read();
		expect(rsetResp).toBe('250 OK\r\n');
		await client.write('RCPT TO:<c@d.com>\r\n');
		const rcptResp = await client.read();
		expect(rcptResp).toBe('503 Bad sequence of commands\r\n');
	});

	it('mid-session EHLO clears the envelope (RFC 5321 §4.1.4)', async () => {
		// RFC 5321 §4.1.4: EHLO starts an SMTP session and resets the
		// server's understanding of the client and advertised extensions.
		// Regression: previously EHLO only set state='idle' without
		// clearing buffers, leaking mailFrom/recipientPaths across sessions.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.4
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		await client.read();
		await client.write('RCPT TO:<c@d.com>\r\n');
		await client.read();
		await ehlo(client);
		await client.write('RCPT TO:<e@f.com>\r\n');
		expect(await client.read()).toBe('503 Bad sequence of commands\r\n');
		await client.write('DATA\r\n');
		expect(await client.read()).toBe('503 Bad sequence of commands\r\n');
	});

	it('drops the connection with 500 when a command line exceeds 512 octets', async () => {
		// RFC 5321 §4.5.3.1.4: "The maximum total length of a command
		// line including the command word and the <CRLF> is 512
		// octets." Outside of DATA mode the sink must refuse an
		// un-terminated tail that has already exceeded that limit
		// instead of growing lineBuffer without bound.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.5.3.1.4
		const client = createClient();
		await client.read();
		// 600 bytes of garbage with no CRLF — comfortably over 512
		// but under the 1000-octet text-line limit, proving the sink
		// uses the *command* limit when not in DATA mode.
		await client.write('A'.repeat(600));
		const resp = await client.read();
		expect(resp).toBe('500 Syntax error, command unrecognized\r\n');
		await expect(client.read()).resolves.toBe('');
	});

	it('drops the connection when a complete command line exceeds 512 octets', async () => {
		// "NOOP " (5) + 506 chars + "\r\n" (2) = 513 octets total,
		// one octet over the RFC 5321 §4.5.3.1.4 command-line limit.
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('NOOP ' + 'A'.repeat(506) + '\r\n');
		const resp = await client.read();
		expect(resp).toBe('500 Syntax error, command unrecognized\r\n');
		await expect(client.read()).resolves.toBe('');
	});

	it('drops the connection with 500 when a DATA text line exceeds 1000 octets', async () => {
		// RFC 5321 §4.5.3.1.6: "The maximum total length of a text
		// line including the <CRLF> is 1000 octets." Inside DATA mode
		// the sink applies the larger text-line limit; an
		// un-terminated 1500-byte tail crosses it and must be
		// refused.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.5.3.1.6
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('RCPT TO:<c@d.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('DATA\r\n');
		expect(await client.read()).toBe(
			'354 Start mail input; end with <CRLF>.<CRLF>\r\n'
		);
		await client.write('Subject: Big\r\n\r\n');
		// 1500 bytes of body with no CRLF — over the 1000-octet
		// text-line limit.
		await client.write('A'.repeat(1500));
		const resp = await client.read();
		expect(resp).toBe('500 Syntax error, command unrecognized\r\n');
		await expect(client.read()).resolves.toBe('');
	});

	it('drops the connection when a complete DATA line exceeds 1000 octets', async () => {
		// 999 body octets + "\r\n" = 1001 octets total, one over
		// the RFC 5321 §4.5.3.1.6 text-line limit.
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('RCPT TO:<c@d.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('DATA\r\n');
		expect(await client.read()).toBe(
			'354 Start mail input; end with <CRLF>.<CRLF>\r\n'
		);
		await client.write('A'.repeat(999) + '\r\n');
		const resp = await client.read();
		expect(resp).toBe('500 Syntax error, command unrecognized\r\n');
		await expect(client.read()).resolves.toBe('');
	});

	it('accepts a command line just under the 512-octet limit', async () => {
		// RFC 5321 §4.5.3.1.4 caps command lines at 512 octets
		// *including the CRLF*, so any compliant command can carry
		// up to 510 octets of payload. NOOP accepts an arbitrary
		// trailing string per §4.1.1.9, which gives us a clean way
		// to test the upper bound without invoking another command's
		// argument validation.
		// References:
		// - https://www.rfc-editor.org/rfc/rfc5321.html#section-4.5.3.1.4
		// - https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.9
		const client = createClient();
		await client.read();
		await ehlo(client);
		// "NOOP " (5) + 505 chars + "\r\n" (2) = 512 octets total.
		await client.write('NOOP ' + 'A'.repeat(505) + '\r\n');
		expect(await client.read()).toMatch(/^250 /);
	});

	it('NOOP returns 250', async () => {
		// RFC 5321 §4.1.1.9: NOOP has no effect on parameters or
		// previously entered commands and always succeeds with 250.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.9
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('NOOP\r\n');
		expect(await client.read()).toBe('250 OK\r\n');
	});

	it('VRFY returns 252', async () => {
		// RFC 5321 §3.5.3 / §4.1.1.6: a server that does not verify
		// addresses but is willing to accept the message answers VRFY
		// with "252 Cannot VRFY user, but will accept message and
		// attempt delivery".
		// References:
		// - https://www.rfc-editor.org/rfc/rfc5321.html#section-3.5.3
		// - https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.6
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('VRFY user\r\n');
		expect(await client.read()).toBe(
			'252 Cannot VRFY user, but will accept message and attempt delivery\r\n'
		);
	});

	it('unknown command returns 500', async () => {
		// RFC 5321 §4.2.4: an unrecognized command produces 500
		// "Syntax error, command unrecognized".
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.2.4
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('XYZZY\r\n');
		expect(await client.read()).toBe(
			'500 Syntax error, command unrecognized\r\n'
		);
	});

	it.each(['EXPN', 'HELP', 'TURN'])(
		'recognized but unimplemented command %s returns 502',
		async (command) => {
			// RFC 5321 §4.2.4: a recognized but unimplemented command
			// produces 502 "Command not implemented". EXPN and HELP
			// are optional per §4.1.1.7 / §4.1.1.8; TURN is the
			// historical RFC 821 §3.8 role-reversal command, listed
			// among RFC 821 features deprecated in RFC 5321 Appendix
			// F.1.
			// References:
			// - https://www.rfc-editor.org/rfc/rfc5321.html#section-4.2.4
			// - https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.7
			// - https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.8
			// - https://www.rfc-editor.org/rfc/rfc821.html#page-18 (§3.8)
			// - https://www.rfc-editor.org/rfc/rfc5321.html#appendix-F.1
			const client = createClient();
			await client.read();
			await ehlo(client);
			await client.write(`${command}\r\n`);
			expect(await client.read()).toBe('502 Command not implemented\r\n');
		}
	);

	it('rejects MAIL FROM with bad syntax', async () => {
		// RFC 5321 §4.1.1.2: the MAIL command requires "FROM:" and a
		// reverse-path; malformed input yields 501.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.2
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL TO:<a@b.com>\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^501 /);
	});

	it('rejects RCPT TO with bad syntax', async () => {
		// RFC 5321 §4.1.1.3: the RCPT command requires "TO:" and a
		// forward-path; malformed input yields 501.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.3
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('RCPT FROM:<a@b.com>\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^501 /);
	});

	it('rejects MAIL FROM with a space after the colon', async () => {
		// RFC 5321 §3.3: "spaces are not permitted on either side of
		// the colon following FROM in the MAIL command or TO in the
		// RCPT command. The syntax is exactly as given above." This
		// is called out explicitly because it has been "a common
		// source of errors".
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-3.3
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM: <a@b.com>\r\n');
		expect(await client.read()).toMatch(/^501 /);
	});

	it('rejects RCPT TO with a space after the colon', async () => {
		// RFC 5321 §3.3: same no-space rule as MAIL FROM. The session
		// must be in the mail state for the rejection to be a syntax
		// error rather than a sequence error, so set up MAIL first.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-3.3
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('RCPT TO: <c@d.com>\r\n');
		expect(await client.read()).toMatch(/^501 /);
	});

	it('rejects MAIL FROM without angle brackets', async () => {
		// RFC 5321 §4.1.2 ABNF: Reverse-path is `Path / "<>"` and
		// `Path = "<" [ A-d-l ":" ] Mailbox ">"`. The angle brackets
		// are mandatory; a bare addr-spec is a syntax error.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.2
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:a@b.com\r\n');
		expect(await client.read()).toMatch(/^501 /);
	});

	it('rejects RCPT TO without angle brackets', async () => {
		// RFC 5321 §4.1.2: Forward-path uses the same `Path`
		// production as Reverse-path, so the brackets are required
		// here too.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.2
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('RCPT TO:c@d.com\r\n');
		expect(await client.read()).toMatch(/^501 /);
	});

	it('rejects the null reverse-path form for RCPT TO', async () => {
		// RFC 5321 §4.5.5 reserves <> for MAIL FROM bounce senders.
		// Forward-path recipients still need a non-empty path.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.5.5
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('RCPT TO:<>\r\n');
		expect(await client.read()).toMatch(/^501 /);
	});

	it('accepts MAIL FROM with trailing ESMTP parameters', async () => {
		// RFC 5321 §4.1.1.2 ABNF:
		//   mail = "MAIL FROM:" Reverse-path
		//          [SP Mail-parameters] CRLF
		// A single SP separates the closing `>` of the path from the
		// optional ESMTP parameter list (e.g. RFC 1870 §6 SIZE=N). The
		// sink must accept the path and ignore the parameters.
		// References:
		// - https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.2
		// - https://www.rfc-editor.org/rfc/rfc1870.html#section-6
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com> SIZE=42\r\n');
		expect(await client.read()).toMatch(/^250 /);
	});

	it('rejects MAIL FROM declaring SIZE above the fixed maximum', async () => {
		// RFC 1870 §6.1: when the SIZE parameter exceeds the fixed
		// maximum message size the server advertised, the server
		// responds with 552 and the transaction does not start.
		// Reference: https://www.rfc-editor.org/rfc/rfc1870.html#section-6.1
		const client = createClient({ maxSize: 100 });
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com> SIZE=101\r\n');
		expect(await client.read()).toBe(
			'552 Message size exceeds fixed maximum message size\r\n'
		);
		// The envelope must not have started: RCPT is out of sequence.
		await client.write('RCPT TO:<c@d.com>\r\n');
		expect(await client.read()).toMatch(/^503 /);
	});

	it('accepts MAIL FROM declaring SIZE equal to the fixed maximum', async () => {
		// RFC 1870 §6.1 rejects only sizes *exceeding* the fixed
		// maximum; a declaration equal to it is acceptable.
		// Reference: https://www.rfc-editor.org/rfc/rfc1870.html#section-6.1
		const client = createClient({ maxSize: 100 });
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com> SIZE=100\r\n');
		expect(await client.read()).toMatch(/^250 /);
	});

	it('matches the SIZE parameter keyword case-insensitively', async () => {
		// RFC 5321 §2.4: ESMTP parameter keywords are case-insensitive.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-2.4
		const client = createClient({ maxSize: 100 });
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com> size=101\r\n');
		expect(await client.read()).toBe(
			'552 Message size exceeds fixed maximum message size\r\n'
		);
	});

	it('rejects MAIL FROM with a malformed SIZE value', async () => {
		// RFC 1870 §4 ABNF: size-value ::= 1*20DIGIT. A non-numeric
		// value is a parameter syntax error (501).
		// Reference: https://www.rfc-editor.org/rfc/rfc1870.html#section-4
		const client = createClient({ maxSize: 100 });
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com> SIZE=12x\r\n');
		expect(await client.read()).toMatch(/^501 /);
	});

	it('aborts a previous transaction when a new MAIL FROM is rejected', async () => {
		// RFC 1870 §6.1: after a 552 SIZE rejection "the transaction
		// never starts" — including any transaction left over from an
		// earlier MAIL command. Without this, DATA could flush an
		// envelope the client believes was rejected.
		// Reference: https://www.rfc-editor.org/rfc/rfc1870.html#section-6.1
		const client = createClient({ maxSize: 100 });
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('RCPT TO:<c@d.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('MAIL FROM:<e@f.com> SIZE=101\r\n');
		expect(await client.read()).toMatch(/^552 /);
		await client.write('DATA\r\n');
		expect(await client.read()).toMatch(/^503 /);
		expect(client.messages).toHaveLength(0);
	});

	it('rejects MAIL FROM with a malformed ESMTP parameter token', async () => {
		// RFC 5321 §4.1.1.2 ABNF: esmtp-keyword starts with ALPHA or
		// DIGIT. The sink ignores unrecognized keywords, but a token
		// that violates the grammar is a 501 syntax error.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.2
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com> !!garbage\r\n');
		expect(await client.read()).toMatch(/^501 /);
	});

	it('validates RCPT TO ESMTP parameters with the same grammar', async () => {
		// RFC 5321 §4.1.1.3: Rcpt-parameters share the esmtp-param
		// grammar. Well-formed keywords are ignored; malformed tokens
		// are a 501 syntax error.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.3
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('RCPT TO:<c@d.com> NOTIFY=SUCCESS\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('RCPT TO:<c@d.com> =broken\r\n');
		expect(await client.read()).toMatch(/^501 /);
	});

	it('rejects RCPT before MAIL', async () => {
		// RFC 5321 §3.3 + §4.1.1.3: RCPT TO can only follow a MAIL
		// FROM in the current transaction; otherwise the server
		// answers 503 "Bad sequence of commands".
		// References:
		// - https://www.rfc-editor.org/rfc/rfc5321.html#section-3.3
		// - https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.3
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('RCPT TO:<a@b.com>\r\n');
		const resp = await client.read();
		expect(resp).toBe('503 Bad sequence of commands\r\n');
	});

	it('rejects DATA before MAIL/RCPT', async () => {
		// RFC 5321 §3.3 + §4.1.1.4: DATA requires at least one
		// successful RCPT (which itself requires a MAIL FROM); else
		// the server answers 503 "Bad sequence of commands".
		// References:
		// - https://www.rfc-editor.org/rfc/rfc5321.html#section-3.3
		// - https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.4
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('DATA\r\n');
		const resp = await client.read();
		expect(resp).toBe('503 Bad sequence of commands\r\n');
	});

	it('QUIT returns 221 and closes', async () => {
		// RFC 5321 §4.1.1.10: the receiver MUST send "221 <domain>
		// Service closing transmission channel" and then close the
		// transmission channel.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.10
		const client = createClient();
		const greeting = await client.read();
		const serverDomain = getServerDomainFromGreeting(greeting);
		await ehlo(client);
		await client.write('QUIT\r\n');
		const resp = await client.read();
		expect(resp).toBe(
			`221 ${serverDomain} Service closing transmission channel\r\n`
		);
	});
});

describe('SmtpSink – data handling', () => {
	it('handles dot-stuffing (lines starting with ..)', async () => {
		// RFC 5321 §4.5.2 (transparency): a leading "." on a body line
		// is doubled by the sender and stripped by the receiver so the
		// end-of-data marker (a bare "." line) cannot be confused with
		// content.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.5.2
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		await client.read();
		await client.write('RCPT TO:<c@d.com>\r\n');
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
		// RFC 1870 §6.3: when the message exceeds the declared SIZE, the
		// server returns 552 after the end-of-data marker.
		// Reference: https://www.rfc-editor.org/rfc/rfc1870.html#section-6.3
		const client = createClient({ maxSize: 100 });
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		await client.read();
		await client.write('RCPT TO:<c@d.com>\r\n');
		await client.read();
		await client.write('DATA\r\n');
		await client.read();
		await client.write('Subject: Big\r\n');
		await client.write('\r\n');
		await client.write('X'.repeat(200) + '\r\n');
		await client.write('.\r\n');
		const resp = await client.read();
		expect(resp).toBe(
			'552 Message size exceeds fixed maximum message size\r\n'
		);
		expect(client.messages).toHaveLength(0);
	});

	it('drains DATA after maxSize overflow and keeps session usable', async () => {
		// Regression: issuing 552 before end-of-data flips out of
		// dataMode, so remaining body lines are parsed as SMTP commands
		// and the session is poisoned. RFC 1870 §6.3 requires the 552
		// to come *after* the end-of-data marker.
		// Reference: https://www.rfc-editor.org/rfc/rfc1870.html#section-6.3
		const client = createClient({ maxSize: 100 });
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		await client.read();
		await client.write('RCPT TO:<c@d.com>\r\n');
		await client.read();
		await client.write('DATA\r\n');
		await client.read();

		let body = 'Subject: Big\r\n\r\n';
		for (let i = 0; i < 200; i++) body += `line${i}\r\n`;
		body += '.\r\n';
		await client.write(body);

		expect(await client.read()).toBe(
			'552 Message size exceeds fixed maximum message size\r\n'
		);
		expect(client.messages).toHaveLength(0);

		await client.write('MAIL FROM:<a@b.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('RCPT TO:<c@d.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('DATA\r\n');
		expect(await client.read()).toMatch(/^354 /);
		await client.write('Subject: Small\r\n\r\nbody\r\n.\r\n');
		expect(await client.read()).toMatch(/^250 /);

		expect(client.messages).toHaveLength(1);
		expect(client.messages[0].subject).toBe('Small');
	});

	it('accepts the null reverse-path MAIL FROM:<> for bounce messages', async () => {
		// RFC 5321 §4.5.5: bounce messages use a null reverse-path,
		// `MAIL FROM:<>`. extractPath previously rejected `<>` and
		// `mailFrom` was left in an undefined state that broke RCPT.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-4.5.5
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('RCPT TO:<postmaster@local>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('DATA\r\n');
		expect(await client.read()).toMatch(/^354 /);
		await client.write('Subject: Bounce\r\n\r\nDelivery failed.\r\n.\r\n');
		expect(await client.read()).toMatch(/^250 /);
		expect(client.messages).toHaveLength(1);
		// Empty envelope-from is preserved (not the literal string "<>").
		// The parsed `from` falls back to the envelope value when no
		// From: header is present, so it should be empty here.
		expect(client.messages[0].from).toBe('');
	});

	it('sends multiple emails in one session', async () => {
		// RFC 5321 §3.3: a transaction starts with MAIL, accepts one
		// or more RCPTs, and is committed by DATA followed by the
		// end-of-data marker. A session may carry further transactions
		// without re-issuing HELO/EHLO; the spec contemplates this
		// when it lets a new MAIL command (or RSET) reset all state
		// tables and buffers.
		// Reference: https://www.rfc-editor.org/rfc/rfc5321.html#section-3.3
		const client = createClient();
		await client.read();
		await ehlo(client);

		await client.write('MAIL FROM:<s@test.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('RCPT TO:<a@test.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('DATA\r\n');
		expect(await client.read()).toMatch(/^354 /);
		await client.write('Subject: First\r\n\r\nBody 1\r\n.\r\n');
		expect(await client.read()).toMatch(/^250 /);

		await client.write('MAIL FROM:<s@test.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('RCPT TO:<b@test.com>\r\n');
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

describe('parseMessage', () => {
	const PDF_BYTES = encoder.encode('%PDF-fake');

	it('parses a simple text/plain email', async () => {
		const raw =
			'Subject: Hello\r\n' +
			'From: Sender <a@b.com>\r\n' +
			'To: Recipient <c@d.com>\r\n' +
			'X-Test: one\r\n' +
			'X-Test: two\r\n' +
			'\r\n' +
			'Body text here.\r\n';
		const result = await parseMessage(raw, 'fallback@x.com', ['fb@y.com']);
		expect(result.subject).toBe('Hello');
		expect(result.from).toBe('Sender <a@b.com>');
		expect(result.to).toBe('Recipient <c@d.com>');
		expect(result.headers['x-test']).toBe('one, two');
		expect(result.text?.trim()).toBe('Body text here.');
		expect(result.attachments).toEqual([]);
	});

	it('falls back to the SMTP envelope when message headers are missing', async () => {
		const result = await parseMessage(
			'Subject: No addrs\r\n\r\nBody.\r\n',
			'env@from.com',
			['a@b.com', 'c@d.com']
		);

		expect(result.from).toBe('env@from.com');
		expect(result.to).toBe('a@b.com, c@d.com');
	});

	it('shows (no subject) when Subject header is missing', async () => {
		const result = await parseMessage(
			'From: a@b.com\r\n\r\nBody.\r\n',
			'',
			[]
		);

		expect(result.subject).toBe('(no subject)');
	});

	it('decodes RFC 2047 encoded headers', async () => {
		const raw =
			'From: =?utf-8?Q?J=C3=B6rg?= <sender@example.com>\r\n' +
			'To: recipient@example.com\r\n' +
			'Subject: =?utf-8?B?w5xuw69jw7ZkZQ==?=\r\n' +
			'\r\n' +
			'Body.\r\n';
		const result = await parseMessage(raw, '', []);

		expect(result.from).toBe('Jörg <sender@example.com>');
		expect(result.subject).toBe('Ünïcöde');
	});

	it('decodes quoted-printable and base64 body parts', async () => {
		const boundary = 'ALT';
		const raw =
			`Subject: Both\r\n` +
			`Content-Type: multipart/alternative; boundary="${boundary}"\r\n` +
			`\r\n` +
			`--${boundary}\r\n` +
			`Content-Type: text/plain; charset=utf-8\r\n` +
			`Content-Transfer-Encoding: quoted-printable\r\n` +
			`\r\n` +
			`Caf=C3=A9\r\n` +
			`--${boundary}\r\n` +
			`Content-Type: text/html; charset=utf-8\r\n` +
			`Content-Transfer-Encoding: base64\r\n` +
			`\r\n` +
			encodeUint8ArrayAsBase64(encoder.encode('<p>Café</p>')) +
			`\r\n--${boundary}--\r\n`;
		const result = await parseMessage(raw, '', []);

		expect(result.text?.trim()).toBe('Café');
		expect(result.html?.trim()).toBe('<p>Café</p>');
	});

	it('decodes attachments from nested multipart messages', async () => {
		const outer = 'OUTER';
		const inner = 'INNER';
		const raw =
			`Subject: Nested\r\n` +
			`Content-Type: multipart/mixed; boundary="${outer}"\r\n` +
			`\r\n` +
			`--${outer}\r\n` +
			`Content-Type: multipart/alternative; boundary="${inner}"\r\n` +
			`\r\n` +
			`--${inner}\r\n` +
			`Content-Type: text/plain; charset=utf-8\r\n\r\nPlain body.\r\n` +
			`--${inner}\r\n` +
			`Content-Type: text/html; charset=utf-8\r\n\r\n<p>HTML body.</p>\r\n` +
			`--${inner}--\r\n` +
			`--${outer}\r\n` +
			`Content-Type: application/pdf; name="invoice.pdf"\r\n` +
			`Content-Transfer-Encoding: base64\r\n` +
			`Content-Disposition: attachment; filename="invoice.pdf"\r\n` +
			`\r\n` +
			encodeUint8ArrayAsBase64(PDF_BYTES) +
			`\r\n--${outer}--\r\n`;
		const result = await parseMessage(raw, '', []);

		expect(result.text?.trim()).toBe('Plain body.');
		expect(result.html?.trim()).toBe('<p>HTML body.</p>');
		expect(result.attachments).toHaveLength(1);
		const attachment = result.attachments[0];
		expect(attachment.filename).toBe('invoice.pdf');
		expect(attachment.contentType).toBe('application/pdf');
		expect(attachment.contentDisposition).toBe('attachment');
		expect(attachment.content).toEqual(PDF_BYTES);
		expect(attachment.size).toBe(PDF_BYTES.byteLength);
	});

	it('collects inline related resources as attachments', async () => {
		const boundary = 'REL';
		const pngBytes = encoder.encode('PNGDATA');
		const raw =
			`Subject: Inline image\r\n` +
			`Content-Type: multipart/related; boundary="${boundary}"\r\n` +
			`\r\n` +
			`--${boundary}\r\n` +
			`Content-Type: text/html; charset=utf-8\r\n\r\n<img src="cid:logo">\r\n` +
			`--${boundary}\r\n` +
			`Content-Type: image/png; name="logo.png"\r\n` +
			`Content-Transfer-Encoding: base64\r\n` +
			`Content-Disposition: inline; filename="logo.png"\r\n` +
			`Content-ID: <logo>\r\n` +
			`\r\n` +
			encodeUint8ArrayAsBase64(pngBytes) +
			`\r\n--${boundary}--\r\n`;
		const result = await parseMessage(raw, '', []);

		expect(result.html?.trim()).toBe('<img src="cid:logo">');
		expect(result.attachments).toHaveLength(1);
		expect(result.attachments[0].filename).toBe('logo.png');
		expect(result.attachments[0].contentDisposition).toBe('inline');
		expect(result.attachments[0].contentId).toBe('logo');
		expect(result.attachments[0].content).toEqual(pngBytes);
	});

	it('parses Uint8Array raw email input', async () => {
		const raw = encoder.encode(
			'Subject: Bytes\r\n\r\nBody from bytes.\r\n'
		);
		const result = await parseMessage(raw, '', []);

		expect(result.subject).toBe('Bytes');
		expect(result.text?.trim()).toBe('Body from bytes.');
	});
});
