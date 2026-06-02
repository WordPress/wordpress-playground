import { createSendmailSpawnHandler } from '../lib/create-sendmail-handler';
import type { CaughtMessage } from '../lib/smtp';

const encoder = new TextEncoder();

describe('createSendmailSpawnHandler', () => {
	it('parses a quoted sendmail command string', async () => {
		const message = await sendMail(
			'"/usr/sbin/sendmail" -t -i -f "sender@example.com"',
			[
				'To: recipient@example.com',
				'Subject: Quoted command',
				'',
				'Body',
			].join('\n')
		);

		expect(message.from).toBe('sender@example.com');
		expect(message.to).toBe('recipient@example.com');
		expect(message.subject).toBe('Quoted command');
	});

	it('supports a separate -f envelope sender argument', async () => {
		const message = await sendMail(
			'/usr/sbin/sendmail -f sender@example.com',
			[
				'To: recipient@example.com',
				'Subject: Separate sender',
				'',
				'Body',
			].join('\n')
		);

		expect(message.from).toBe('sender@example.com');
	});

	it('supports an attached -f envelope sender argument', async () => {
		const message = await sendMail(
			'/usr/sbin/sendmail -fsender@example.com',
			[
				'To: recipient@example.com',
				'Subject: Attached sender',
				'',
				'Body',
			].join('\n')
		);

		expect(message.from).toBe('sender@example.com');
	});

	it('preserves an empty -f argument passed in argsArray', async () => {
		const message = await sendMail(
			'/usr/sbin/sendmail',
			[
				'To: recipient@example.com',
				'Subject: Empty envelope sender from argsArray',
				'',
				'Body',
			].join('\n'),
			['-f', '', '-t']
		);

		expect(message.from).toBe('');
	});

	it('stops parsing envelope sender options after --', async () => {
		const message = await sendMail(
			'/usr/sbin/sendmail -f sender@example.com -- -fignored@example.com',
			[
				'To: recipient@example.com',
				'Subject: End of options',
				'',
				'Body',
			].join('\n')
		);

		expect(message.from).toBe('sender@example.com');
	});

	it('rejects messages that exceed maxSize', async () => {
		const onEmail = vitest.fn();
		const spawnHandler = createSendmailSpawnHandler(onEmail, undefined, {
			maxSize: 5,
		});
		const childProcess = spawnHandler('/usr/sbin/sendmail -t');
		const stderr: string[] = [];

		childProcess.stderr.on('data', (data: ArrayBuffer) => {
			stderr.push(new TextDecoder().decode(data));
		});

		const exitCode = await new Promise<number>((resolve) => {
			childProcess.on('spawn', () => {
				childProcess.stdin.write(encoder.encode('123456'));
				childProcess.stdin.end();
			});
			childProcess.on('exit', resolve);
		});

		expect(exitCode).toBe(1);
		expect(onEmail).not.toHaveBeenCalled();
		expect(stderr.join('')).toContain('message exceeds maximum size');
	});
});

async function sendMail(
	command: string | string[],
	rawMessage: string,
	argsArray: string[] = []
): Promise<CaughtMessage> {
	let caughtMessage: CaughtMessage | undefined;
	const spawnHandler = createSendmailSpawnHandler((message) => {
		caughtMessage = message;
	});
	const childProcess = spawnHandler(command, argsArray);

	const exitCode = await new Promise<number>((resolve) => {
		childProcess.on('spawn', () => {
			childProcess.stdin.write(encoder.encode(rawMessage));
			childProcess.stdin.end();
		});
		childProcess.on('exit', resolve);
	});

	expect(exitCode).toBe(0);
	expect(caughtMessage).toBeDefined();
	return caughtMessage!;
}
