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

describe('SmtpSink – happy path', () => {
	it('captures an email through a full SMTP transaction', async () => {
		// Walks the canonical SMTP transaction from RFC 5321 §3.3:
		// 220 greeting → HELO → MAIL FROM → RCPT TO → DATA (354) →
		// body terminated by ".<CRLF>" (250 queued) → QUIT (221).
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
		expect(await client.read()).toMatch(/^354 /);

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
		const client = createClient();
		await client.read();
		await client.write('EHLO\r\n');
		expect(await client.read()).toMatch(/^501 /);
	});

	it('rejects HELO with no domain argument', async () => {
		// RFC 5321 §4.1.1.1 ABNF:
		//   helo = "HELO" SP Domain CRLF
		// Domain is mandatory; a bare "HELO\r\n" is a syntax error.
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
		const client = createClient();
		await client.read();
		await client.write('EHLO client.example.com\r\n');
		const first = await client.read();
		// The first reply line is "250-<Domain>[ SP ehlo-greet]".
		// The greeter is "localhost", matching the 220 banner.
		expect(first).toMatch(/^250-localhost(\s|\r\n)/);
	});

	it('HELO greeting line starts with the server domain', async () => {
		// RFC 5321 §4.1.1.1 ABNF for HELO uses the same single-line
		// `"250" SP Domain [ SP ehlo-greet ]` shape.
		const client = createClient();
		await client.read();
		await client.write('HELO client.example.com\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^250 localhost(\s|\r\n)/);
	});
});

describe('SmtpSink – STARTTLS', () => {
	it('refuses STARTTLS with 502', async () => {
		// RFC 5321 §4.2.4: an unimplemented command is answered with
		// 502. The sink never advertises STARTTLS in EHLO, so a
		// client that issues it anyway is treated as having sent an
		// unrecognized command.
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('STARTTLS\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^502 /);
	});
});

describe('SmtpSink – AUTH PLAIN', () => {
	it('accepts valid credentials inline', async () => {
		// RFC 4954 §4 (initial-response form) + RFC 4616 §2 (PLAIN
		// SASL message: [authzid] UTF8NUL authcid UTF8NUL passwd).
		// Success returns 235.
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		// PLAIN: \0username\0password in base64
		const credentials = btoa('\0user\0pass');
		await client.write(`AUTH PLAIN ${credentials}\r\n`);
		const resp = await client.read();
		expect(resp).toMatch(/^235 /);
	});

	it('accepts valid credentials via challenge-response', async () => {
		// RFC 4954 §4: when no initial response is supplied, the server
		// issues "334 " with an empty challenge and the client follows
		// up with the SASL response on its own line.
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
		expect(resp).toMatch(/^235 /);
	});

	it('rejects invalid credentials', async () => {
		// RFC 4954 §6: bad credentials produce "535 5.7.8
		// Authentication credentials invalid".
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
		expect(resp).toMatch(/^535 /);
	});

	it('allows cancellation with *', async () => {
		// RFC 4954 §4: a single "*" sent in place of a SASL response
		// cancels the AUTH exchange; the server returns 501.
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
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

describe('SmtpSink – AUTH LOGIN', () => {
	it('completes multi-step LOGIN flow', async () => {
		// LOGIN SASL is non-standard (draft-murchison-sasl-login) but
		// universally deployed: server prompts with base64("Username:")
		// then base64("Password:") via 334 challenges, then 235 on
		// success per RFC 4954 §4.
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
		expect(resp).toMatch(/^235 /);
	});

	it('accepts initial-response as username', async () => {
		// RFC 4954 §4: clients may bundle the first SASL response onto
		// the AUTH command line. For LOGIN that response is the
		// username, so the server skips straight to the password
		// challenge.
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
		expect(resp).toMatch(/^235 /);
	});

	it('rejects invalid LOGIN credentials', async () => {
		// RFC 4954 §6: failed authentication exchange returns 535.
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
		expect(resp).toMatch(/^535 /);
	});
});

describe('SmtpSink – AUTH edge cases', () => {
	it('rejects AUTH with no mechanism', async () => {
		// RFC 4954 §4: AUTH command requires a mechanism argument;
		// the server replies 501 on syntax errors.
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write('AUTH\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^501 /);
	});

	it('rejects already-authenticated client', async () => {
		// RFC 4954 §4: after a successful AUTH, further AUTH commands
		// in the same session must be rejected with 503.
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
		const client = createClient({
			auth: { mechanisms: ['PLAIN'] },
		});
		await client.read();
		await ehlo(client);
		await client.write('AUTH CRAM-MD5\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^504 /);
	});

	it('rejects MAIL/RCPT when requireAuth and not authenticated', async () => {
		// RFC 4954 §6: "530 5.7.0 Authentication required" SHOULD be
		// returned by any command other than AUTH/EHLO/HELO/NOOP/RSET/
		// QUIT when server policy requires authentication and the
		// session is not yet authenticated.
		const client = createClient({
			auth: { mechanisms: ['PLAIN'], requireAuth: true },
		});
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		const mailResp = await client.read();
		expect(mailResp).toMatch(/^530 /);
		await client.write('RCPT TO:<c@d.com>\r\n');
		const rcptResp = await client.read();
		expect(rcptResp).toMatch(/^530 /);
	});
});

describe('SmtpSink – command edge cases', () => {
	it('RSET clears the envelope', async () => {
		// RFC 5321 §4.1.1.5: RSET aborts the current mail transaction
		// and clears reverse-path / forward-paths / mail data buffers,
		// then the server replies 250.
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		await client.read();
		await client.write('RSET\r\n');
		const rsetResp = await client.read();
		expect(rsetResp).toMatch(/^250 /);
		await client.write('RCPT TO:<c@d.com>\r\n');
		const rcptResp = await client.read();
		expect(rcptResp).toMatch(/^503 /);
	});

	it('mid-session EHLO clears the envelope (RFC 5321 §4.1.4)', async () => {
		// Regression: previously EHLO only set state='idle' without
		// clearing buffers, leaking mailFrom/recipientPaths across sessions.
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		await client.read();
		await client.write('RCPT TO:<c@d.com>\r\n');
		await client.read();
		await ehlo(client);
		await client.write('RCPT TO:<e@f.com>\r\n');
		expect(await client.read()).toMatch(/^503 /);
		await client.write('DATA\r\n');
		expect(await client.read()).toMatch(/^503 /);
	});

	it('drops the connection with 500 when a command line exceeds 512 octets', async () => {
		// RFC 5321 §4.5.3.1.4: "The maximum total length of a command
		// line including the command word and the <CRLF> is 512
		// octets." Outside of DATA mode the sink must refuse an
		// un-terminated tail that has already exceeded that limit
		// instead of growing lineBuffer without bound.
		const client = createClient();
		await client.read();
		// 600 bytes of garbage with no CRLF — comfortably over 512
		// but under the 1000-octet text-line limit, proving the sink
		// uses the *command* limit when not in DATA mode.
		await client.write('A'.repeat(600));
		const resp = await client.read();
		expect(resp).toMatch(/^500 /);
		await expect(client.read()).resolves.toBe('');
	});

	it('drops the connection with 500 when a DATA text line exceeds 1000 octets', async () => {
		// RFC 5321 §4.5.3.1.6: "The maximum total length of a text
		// line including the <CRLF> is 1000 octets." Inside DATA mode
		// the sink applies the larger text-line limit; an
		// un-terminated 1500-byte tail crosses it and must be
		// refused.
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('RCPT TO:<c@d.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('DATA\r\n');
		expect(await client.read()).toMatch(/^354 /);
		await client.write('Subject: Big\r\n\r\n');
		// 1500 bytes of body with no CRLF — over the 1000-octet
		// text-line limit.
		await client.write('A'.repeat(1500));
		const resp = await client.read();
		expect(resp).toMatch(/^500 /);
		await expect(client.read()).resolves.toBe('');
	});

	it('accepts a command line just under the 512-octet limit', async () => {
		// RFC 5321 §4.5.3.1.4 caps command lines at 512 octets
		// *including the CRLF*, so any compliant command can carry
		// up to 510 octets of payload. NOOP accepts an arbitrary
		// trailing string per §4.1.1.9, which gives us a clean way
		// to test the upper bound without invoking another command's
		// argument validation.
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
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('NOOP\r\n');
		expect(await client.read()).toMatch(/^250 /);
	});

	it('VRFY returns 252', async () => {
		// RFC 5321 §3.5.3 / §4.1.1.6: a server that does not verify
		// addresses but is willing to accept the message answers VRFY
		// with "252 Cannot VRFY user, but will accept message".
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('VRFY user\r\n');
		expect(await client.read()).toMatch(/^252 /);
	});

	it('unknown command returns 500', async () => {
		// RFC 5321 §4.2.4: an unrecognized command produces 500
		// "Syntax error, command unrecognized".
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('XYZZY\r\n');
		expect(await client.read()).toMatch(/^500 /);
	});

	it.each(['EXPN', 'HELP', 'TURN'])(
		'recognized but unimplemented command %s returns 502',
		async (command) => {
			// RFC 5321 §4.2.4: a recognized but unimplemented command
			// produces 502 "Command not implemented". EXPN and HELP
			// are optional per §4.1.1.7 / §4.1.1.8; TURN is the
			// historical RFC 821 reverse-direction command, listed
			// among RFC 821 features deprecated in RFC 5321 Appendix
			// F.1.
			const client = createClient();
			await client.read();
			await ehlo(client);
			await client.write(`${command}\r\n`);
			expect(await client.read()).toMatch(/^502 /);
		}
	);

	it('rejects MAIL FROM with bad syntax', async () => {
		// RFC 5321 §4.1.1.2: the MAIL command requires "FROM:" and a
		// reverse-path; malformed input yields 501.
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
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com>\r\n');
		expect(await client.read()).toMatch(/^250 /);
		await client.write('RCPT TO:c@d.com\r\n');
		expect(await client.read()).toMatch(/^501 /);
	});

	it('accepts MAIL FROM with trailing ESMTP parameters', async () => {
		// RFC 5321 §4.1.1.2 ABNF:
		//   mail = "MAIL FROM:" Reverse-path
		//          [SP Mail-parameters] CRLF
		// A single SP separates the closing `>` of the path from the
		// optional ESMTP parameter list (e.g. RFC 1870 SIZE=N). The
		// sink must accept the path and ignore the parameters.
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('MAIL FROM:<a@b.com> SIZE=42\r\n');
		expect(await client.read()).toMatch(/^250 /);
	});

	it('rejects RCPT before MAIL', async () => {
		// RFC 5321 §3.3 + §4.1.1.3: RCPT TO can only follow a MAIL
		// FROM in the current transaction; otherwise the server
		// answers 503 "Bad sequence of commands".
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('RCPT TO:<a@b.com>\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^503 /);
	});

	it('rejects DATA before MAIL/RCPT', async () => {
		// RFC 5321 §3.3 + §4.1.1.4: DATA requires at least one
		// successful RCPT (which itself requires a MAIL FROM); else
		// the server answers 503 "Bad sequence of commands".
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('DATA\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^503 /);
	});

	it('QUIT returns 221 and closes', async () => {
		// RFC 5321 §4.1.1.10: the receiver MUST send "221 <domain>
		// Service closing transmission channel" and then close the
		// transmission channel.
		const client = createClient();
		await client.read();
		await ehlo(client);
		await client.write('QUIT\r\n');
		const resp = await client.read();
		expect(resp).toMatch(/^221 /);
	});
});

describe('SmtpSink – data handling', () => {
	it('handles dot-stuffing (lines starting with ..)', async () => {
		// RFC 5321 §4.5.2 (transparency): a leading "." on a body line
		// is doubled by the sender and stripped by the receiver so the
		// end-of-data marker (a bare "." line) cannot be confused with
		// content.
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
		// RFC 1870 §6.3: when the message exceeds the SIZE the server
		// declared, the server returns "552 Message size exceeds fixed
		// maximum message size" after the end-of-data marker.
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
		expect(resp).toMatch(/^552 /);
		expect(client.messages).toHaveLength(0);
	});

	it('drains DATA after maxSize overflow and keeps session usable', async () => {
		// Regression: issuing 552 before end-of-data flips out of
		// dataMode, so remaining body lines are parsed as SMTP commands
		// and the session is poisoned. RFC 1870 §6.3 requires the 552
		// to come *after* the end-of-data marker.
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

		expect(await client.read()).toMatch(/^552 /);
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
	it('parses a simple text/plain email', () => {
		// RFC 5322 §2.1: a message is header fields followed by an
		// empty line followed by the body. RFC 2045 §5 defaults the
		// Content-Type to text/plain when no header is present.
		const raw =
			'Subject: Hello\r\n' +
			'From: a@b.com\r\n' +
			'To: c@d.com\r\n' +
			'\r\n' +
			'Body text here.\r\n';
		const result = parseMessage(raw, 'fallback@x.com', ['fb@y.com']);
		expect(result.subject).toBe('Hello');
		expect(result.from).toBe('a@b.com');
		expect(result.to).toBe('c@d.com');
		expect(result.text?.trim()).toBe('Body text here.');
	});

	it('preserves all recipients from a multi-recipient To header', () => {
		// RFC 5322 §3.4: an address-list is a comma-separated sequence
		// of mailbox / group productions, mixing "Display Name <addr>"
		// and bare addr-spec forms.
		const raw =
			'From: sender@test.com\r\n' +
			'To: Foo Bar <foo@test.com>, bare@test.com, ' +
			'"Quoted Name" <quoted@test.com>\r\n' +
			'Subject: Multi recipient\r\n' +
			'\r\n' +
			'Body.\r\n';
		const result = parseMessage(raw, '', []);
		expect(result.to).toContain('foo@test.com');
		expect(result.to).toContain('bare@test.com');
		expect(result.to).toContain('quoted@test.com');
	});

	it('uses fallback from/to when headers are missing', () => {
		// RFC 5321 §2.3.1 (Mail Objects): a mail object has an
		// envelope (MAIL FROM / RCPT TO) and a content with its own
		// header section. When the header omits From:/To: we fall
		// back to the envelope values supplied by the SMTP
		// transaction.
		const raw = 'Subject: No addrs\r\n\r\nBody.\r\n';
		const result = parseMessage(raw, 'env@from.com', [
			'env@to1.com',
			'env@to2.com',
		]);
		expect(result.from).toBe('env@from.com');
		expect(result.to).toBe('env@to1.com, env@to2.com');
	});

	it('shows (no subject) when Subject header is missing', () => {
		// RFC 5322 §3.6.5: Subject is an optional header field. No
		// spec mandates a placeholder; "(no subject)" is the
		// long-standing MUA convention.
		const raw = 'From: a@b.com\r\n\r\nBody.\r\n';
		const result = parseMessage(raw, '', []);
		expect(result.subject).toBe('(no subject)');
	});

	it('decodes RFC 2047 base64 encoded subject', () => {
		// RFC 2047 §4.1: encoded-word with "B" encoding wraps base64
		// of the byte sequence in the named charset.
		// "Test" in base64
		const encoded = '=?utf-8?B?VGVzdA==?=';
		const raw = `Subject: ${encoded}\r\n\r\nBody.\r\n`;
		const result = parseMessage(raw, '', []);
		expect(result.subject).toBe('Test');
	});

	it('decodes RFC 2047 Q-encoded subject', () => {
		// RFC 2047 §4.2: Q-encoding is a quoted-printable variant
		// where "_" represents 0x20 (space) inside encoded-words.
		// "Hello World" Q-encoded (underscore = space)
		const encoded = '=?utf-8?Q?Hello_World?=';
		const raw = `Subject: ${encoded}\r\n\r\nBody.\r\n`;
		const result = parseMessage(raw, '', []);
		expect(result.subject).toBe('Hello World');
	});

	it('decodes adjacent RFC 2047 encoded words with emoji', () => {
		// RFC 2047 §6.2: linear white space between adjacent
		// encoded-words is ignored. The second encoded-word is the UTF-8
		// byte sequence for 🚀.
		const encoded = '=?utf-8?B?SGVsbG8g?= =?utf-8?B?8J+agA==?=';
		const raw = `Subject: ${encoded}\r\n\r\nBody.\r\n`;
		const result = parseMessage(raw, '', []);
		expect(result.subject).toBe('Hello 🚀');
	});

	it('decodes RFC 2047 base64 UTF-16BE subject', () => {
		// RFC 2047 B-encoding carries the raw bytes of the declared
		// charset. These are UTF-16BE bytes for "Hi 🚀", including the
		// D83D DE80 surrogate pair.
		const bytes = new Uint8Array([
			0x00, 0x48, 0x00, 0x69, 0x00, 0x20, 0xd8, 0x3d, 0xde, 0x80,
		]);
		const encoded = `=?utf-16be?B?${encodeUint8ArrayAsBase64(bytes)}?=`;
		const raw = `Subject: ${encoded}\r\n\r\nBody.\r\n`;
		const result = parseMessage(raw, '', []);
		expect(result.subject).toBe('Hi 🚀');
	});

	it('decodes RFC 2047 Q-encoded UTF-16LE subject', () => {
		// Q-encoding is still byte transport, not character escaping.
		// This spells UTF-16LE bytes for "Hi 🚀": 48 00 69 00 20 00
		// 3D D8 80 DE. "_" contributes byte 0x20 before the following =00.
		const encoded = '=?utf-16le?Q?H=00i=00_=00=3D=D8=80=DE?=';
		const raw = `Subject: ${encoded}\r\n\r\nBody.\r\n`;
		const result = parseMessage(raw, '', []);
		expect(result.subject).toBe('Hi 🚀');
	});

	it('replaces invalid UTF-8 code points in RFC 2047 subjects', () => {
		// ED A0 80 is the UTF-8 byte sequence for the surrogate U+D800.
		// Surrogates are not valid Unicode scalar values, so TextDecoder
		// emits replacement characters instead of throwing.
		const bytes = new Uint8Array([0xed, 0xa0, 0x80]);
		const encoded = `=?utf-8?B?${encodeUint8ArrayAsBase64(bytes)}?=`;
		const raw = `Subject: ${encoded}\r\n\r\nBody.\r\n`;
		const result = parseMessage(raw, '', []);
		expect(result.subject).toBe('\uFFFD\uFFFD\uFFFD');
	});

	it('leaves invalid RFC 2047 encoded words unchanged', () => {
		// Invalid encoded-words should not make the small helper throw;
		// keeping the original header value is more useful to callers.
		const encoded = '=?utf-8?B?!!!!?=';
		const raw = `Subject: ${encoded}\r\n\r\nBody.\r\n`;
		const result = parseMessage(raw, '', []);
		expect(result.subject).toBe(encoded);
	});

	it('preserves UTF-8 text body without transfer encoding', () => {
		const raw =
			'Subject: UTF-8 body\r\n' +
			'Content-Type: text/plain; charset=utf-8\r\n' +
			'\r\n' +
			'Hello 🚀\r\n';
		const result = parseMessage(raw, '', []);
		expect(result.text).toContain('Hello 🚀');
	});

	it('decodes quoted-printable body', () => {
		// RFC 2045 §6.7: quoted-printable encodes non-ASCII octets as
		// "=XX" hex escapes; the receiver reverses the escape using
		// the declared charset.
		const raw =
			'Subject: QP\r\n' +
			'Content-Type: text/plain; charset=utf-8\r\n' +
			'Content-Transfer-Encoding: quoted-printable\r\n' +
			'\r\n' +
			'Hello =C3=A9 world\r\n';
		const result = parseMessage(raw, '', []);
		expect(result.text).toContain('Hello é world');
	});

	it('decodes quoted-printable UTF-8 emoji body', () => {
		const raw =
			'Subject: QP emoji\r\n' +
			'Content-Type: text/plain; charset=utf-8\r\n' +
			'Content-Transfer-Encoding: quoted-printable\r\n' +
			'\r\n' +
			'Hello =F0=9F=9A=80\r\n';
		const result = parseMessage(raw, '', []);
		expect(result.text).toContain('Hello 🚀');
	});

	it('replaces malformed UTF-8 in transfer-encoded bodies', () => {
		// C0 AF is an overlong UTF-8 encoding for "/". Overlong
		// encodings are invalid, so the UTF-8 decoder returns U+FFFD.
		const raw =
			'Subject: Invalid UTF-8 body\r\n' +
			'Content-Type: text/plain; charset=utf-8\r\n' +
			'Content-Transfer-Encoding: base64\r\n' +
			'\r\n' +
			encodeUint8ArrayAsBase64(new Uint8Array([0xc0, 0xaf])) +
			'\r\n';
		const result = parseMessage(raw, '', []);
		expect(result.text?.trim()).toBe('\uFFFD\uFFFD');
	});

	it('decodes base64 body', () => {
		// RFC 2045 §6.8: base64 encodes arbitrary octet streams in a
		// 65-character ASCII subset for transport over 7-bit channels.
		const raw =
			'Subject: B64\r\n' +
			'Content-Type: text/plain; charset=utf-8\r\n' +
			'Content-Transfer-Encoding: base64\r\n' +
			'\r\n' +
			btoa('Decoded body content') +
			'\r\n';
		const result = parseMessage(raw, '', []);
		expect(result.text?.trim()).toBe('Decoded body content');
	});

	it('extracts text/plain from multipart email', () => {
		// RFC 2046 §5.1: multipart bodies are split by a "--boundary"
		// delimiter and terminated by "--boundary--". multipart/
		// alternative (§5.1.4) lets a sender supply the same content
		// in several formats; receivers pick the best they can render.
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
		const result = parseMessage(raw, '', []);
		expect(result.subject).toBe('Multi');
		expect(result.text?.trim()).toBe('Plain text part.');
	});

	it('handles folded headers', () => {
		// RFC 5322 §2.2.3: a long header field may be split onto
		// multiple lines by inserting CRLF before any WSP. The
		// receiver "unfolds" by removing the CRLF before the WSP.
		const raw =
			'Subject: This is a very long\r\n' +
			' subject line that was folded\r\n' +
			'From: a@b.com\r\n' +
			'\r\n' +
			'Body.\r\n';
		const result = parseMessage(raw, '', []);
		expect(result.subject).toBe(
			'This is a very long subject line that was folded'
		);
	});

	it('handles email with no body', () => {
		// RFC 5322 §2.1: a body is OPTIONAL; if present it is
		// separated from the headers by a single empty line. With no
		// separator the body is empty.
		const raw = 'Subject: Empty\r\nFrom: a@b.com\r\n';
		const result = parseMessage(raw, '', []);
		expect(result.subject).toBe('Empty');
		expect(result.text).toBe('');
	});
});
