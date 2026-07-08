import { createSendmailSpawnHandler } from '../lib/create-sendmail-handler';
import type { CaughtMessage } from '../lib/smtp';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe('createSendmailSpawnHandler', () => {
	it('parses a quoted sendmail command string', async () => {
		const result = await sendMail(
			'"/usr/sbin/sendmail" -t -i -f "sender@example.com"',
			[
				'To: recipient@example.com',
				'Subject: Quoted command',
				'',
				'Body',
			].join('\n')
		);

		expect(result.exitCode).toBe(0);
		expect(result.message).toMatchObject({
			from: 'sender@example.com',
			to: 'recipient@example.com',
			subject: 'Quoted command',
		});
	});

	it('supports a separate -f envelope sender argument', async () => {
		const result = await sendMail(
			'/usr/sbin/sendmail -f sender@example.com',
			[
				'To: recipient@example.com',
				'Subject: Separate sender',
				'',
				'Body',
			].join('\n')
		);

		expect(result.exitCode).toBe(0);
		expect(result.message?.from).toBe('sender@example.com');
	});

	it('supports an attached -f envelope sender argument', async () => {
		const result = await sendMail(
			'/usr/sbin/sendmail -fsender@example.com',
			[
				'To: recipient@example.com',
				'Subject: Attached sender',
				'',
				'Body',
			].join('\n')
		);

		expect(result.exitCode).toBe(0);
		expect(result.message?.from).toBe('sender@example.com');
	});

	it('preserves an empty -f argument passed in argsArray', async () => {
		const result = await sendMail(
			'/usr/sbin/sendmail',
			[
				'To: recipient@example.com',
				'Subject: Empty envelope sender from argsArray',
				'',
				'Body',
			].join('\n'),
			{ argsArray: ['-f', '', '-t'] }
		);

		expect(result.exitCode).toBe(0);
		expect(result.message?.from).toBe('');
	});

	it('stops parsing envelope sender options after --', async () => {
		const result = await sendMail(
			'/usr/sbin/sendmail -f sender@example.com -- -fignored@example.com',
			[
				'To: recipient@example.com',
				'Subject: End of options',
				'',
				'Body',
			].join('\n')
		);

		expect(result.exitCode).toBe(0);
		expect(result.message?.from).toBe('sender@example.com');
	});

	it('captures attachments from a MIME message with LF-only line endings', async () => {
		// PHP 7 pipes LF-only messages to sendmail; the handler
		// normalizes them to CRLF before parsing.
		const result = await sendMail(
			'/usr/sbin/sendmail -t -i',
			[
				'To: recipient@example.com',
				'Subject: With attachment',
				'MIME-Version: 1.0',
				'Content-Type: multipart/mixed; boundary="MIX"',
				'',
				'--MIX',
				'Content-Type: text/plain; charset=utf-8',
				'',
				'Body text.',
				'--MIX',
				'Content-Type: application/pdf; name="invoice.pdf"',
				'Content-Transfer-Encoding: base64',
				'Content-Disposition: attachment; filename="invoice.pdf"',
				'',
				btoa('%PDF-fake'),
				'--MIX--',
			].join('\n')
		);

		expect(result.exitCode).toBe(0);
		expect(result.message?.text?.trim()).toBe('Body text.');
		expect(result.message?.attachments).toHaveLength(1);
		const attachment = result.message!.attachments[0];
		expect(attachment.filename).toBe('invoice.pdf');
		expect(attachment.contentType).toBe('application/pdf');
		expect(attachment.contentDisposition).toBe('attachment');
		expect(decoder.decode(attachment.content)).toBe('%PDF-fake');
		expect(attachment.size).toBe('%PDF-fake'.length);
	});

	it('rejects messages that exceed maxSize', async () => {
		const result = await sendMail('/usr/sbin/sendmail -t', '123456', {
			maxSize: 5,
		});

		expect(result.exitCode).toBe(1);
		expect(result.message).toBeUndefined();
		expect(result.stderr).toContain('message exceeds maximum size');
	});
});

async function sendMail(
	command: string | string[],
	rawMessage: string,
	{ argsArray = [], maxSize }: { argsArray?: string[]; maxSize?: number } = {}
): Promise<{
	exitCode: number;
	message?: CaughtMessage;
	stderr: string;
}> {
	let caughtMessage: CaughtMessage | undefined;
	const spawnHandler = createSendmailSpawnHandler(
		(message) => {
			caughtMessage = message;
		},
		undefined,
		{ maxSize }
	);
	const childProcess = spawnHandler(command, argsArray);
	const stderr: string[] = [];

	childProcess.stderr.on('data', (data: ArrayBuffer) => {
		stderr.push(decoder.decode(data));
	});

	const exitCode = await new Promise<number>((resolve) => {
		childProcess.on('spawn', () => {
			childProcess.stdin.write(encoder.encode(rawMessage));
			childProcess.stdin.end();
		});
		childProcess.on('exit', resolve);
	});

	return {
		exitCode,
		message: caughtMessage,
		stderr: stderr.join(''),
	};
}
