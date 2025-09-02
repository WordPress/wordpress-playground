import { describe, it, expect, vi } from 'vitest';
import { SmtpSink, makeLoopbackPair, CaughtMessage } from './smtp';

describe('SmtpSink', () => {
	it('captures an email and emits email-sent event', async () => {
		const [duplexClient, duplexServer] = makeLoopbackPair();
		const onMessage = vi.fn();
		const sink = new SmtpSink(duplexServer, onMessage);

		const emailSent = new Promise<CaughtMessage>((resolve) => {
			sink.addEventListener('email-sent', (event) => {
				const e = event as CustomEvent<CaughtMessage>;
				resolve(e.detail);
			});
		});

		// Start the sink server (do not await; it runs until the stream ends)
		void sink.start();

		const writer = duplexClient.writable.getWriter();
		const reader = duplexClient.readable.getReader();
		const decoder = new TextDecoder();

		async function readResponse(): Promise<string> {
			const { value } = await reader.read();
			if (!value) return '';
			return decoder.decode(value);
		}

		// Greeting
		const greeting = await readResponse();
		expect(greeting).toMatch(/^220 /);

		// HELO (may be multi-line: 250-..., ..., 250 <last>)
		await writer.write(new TextEncoder().encode('HELO localhost\r\n'));
		let helo = await readResponse();
		while (/^250-/.test(helo)) {
			helo = await readResponse();
		}
		expect(helo).toMatch(/^250 /);

		// MAIL FROM
		await writer.write(
			new TextEncoder().encode('MAIL FROM: <test@localhost>\r\n')
		);
		const mailFromResp = await readResponse();
		expect(mailFromResp).toMatch(/^250 /);

		// RCPT TO
		await writer.write(
			new TextEncoder().encode('RCPT TO: <test2@localhost>\r\n')
		);
		const rcptToResp = await readResponse();
		expect(rcptToResp).toMatch(/^250 /);

		// DATA
		await writer.write(new TextEncoder().encode('DATA\r\n'));
		const dataResp = await readResponse();
		expect(dataResp).toMatch(/^354 /);

		// Message content
		await writer.write(new TextEncoder().encode('Subject: Test Email\r\n'));
		await writer.write(
			new TextEncoder().encode('From: test@localhost\r\n')
		);
		await writer.write(new TextEncoder().encode('To: test2@localhost\r\n'));
		await writer.write(new TextEncoder().encode('\r\n'));
		await writer.write(
			new TextEncoder().encode('This is the email body content.\r\n')
		);
		await writer.write(new TextEncoder().encode('.\r\n'));
		const queuedResp = await readResponse();
		expect(queuedResp).toMatch(/^250 /);

		// QUIT
		await writer.write(new TextEncoder().encode('QUIT\r\n'));
		const quitResp = await readResponse();
		expect(quitResp).toMatch(/^221 /);

		await writer.close();

		// Wait for event
		const msg = await emailSent;
		expect(msg.subject).toBe('Test Email');
		expect(msg.from).toContain('test@localhost');
		expect(msg.to).toContain('test2@localhost');
		expect((msg.text || '').trim()).toBe('This is the email body content.');

		expect(onMessage).toHaveBeenCalledTimes(1);
		const firstArg = onMessage.mock.calls[0][0] as CaughtMessage;
		expect(firstArg.id).toBe(msg.id);
	});
});
