import {
	createSendmailCaptureSpawnHandler,
	type RawSendmailMessage,
	SENDMAIL_CAPTURE_MAX_SIZE,
} from '../lib/create-sendmail-capture-handler';
import { createSpawnHandler } from '../lib/create-spawn-handler';

describe('createSendmailCaptureSpawnHandler dispatch', () => {
	it('exits 127 for non-sendmail commands when no fallback handler exists', async () => {
		const captured: unknown[] = [];
		const handler = createSendmailCaptureSpawnHandler((message) => {
			captured.push(message);
		});

		const child = handler('ls -la', [], {});
		const exitCode = await new Promise<number>((resolve) => {
			child.on('exit', (code: number) => resolve(code));
		});

		expect(exitCode).toBe(127);
		expect(captured).toHaveLength(0);
	});

	it('delegates non-sendmail commands to the fallback handler', async () => {
		const seen: string[][] = [];
		const fallback = createSpawnHandler(async (command, processApi) => {
			seen.push(command);
			await Promise.resolve();
			processApi.exit(0);
		});
		const handler = createSendmailCaptureSpawnHandler(() => {}, fallback);

		const child = handler('ls -la', [], {});
		const exitCode = await new Promise<number>((resolve) => {
			child.on('exit', (code: number) => resolve(code));
		});

		expect(exitCode).toBe(0);
		expect(seen).toEqual([['ls', '-la']]);
	});

	it('captures the sendmail command and stdin bytes', async () => {
		const captured: RawSendmailMessage[] = [];
		const handler = createSendmailCaptureSpawnHandler((message) => {
			captured.push(message);
		});

		const child = handler(
			'/usr/sbin/sendmail -t -i -fsender@test.com',
			[],
			{}
		);
		child.stdin.write(new TextEncoder().encode('Subject: Test\n\nBody'));
		child.stdin.end();
		const exitCode = await new Promise<number>((resolve) => {
			child.on('exit', (code: number) => resolve(code));
		});

		expect(exitCode).toBe(0);
		expect(captured).toHaveLength(1);
		expect(captured[0].command).toEqual([
			'/usr/sbin/sendmail',
			'-t',
			'-i',
			'-fsender@test.com',
		]);
		expect(captured[0].text).toBe('Subject: Test\n\nBody');
	});

	it('rejects messages larger than the fixed capture limit', async () => {
		const captured: unknown[] = [];
		const stderr: string[] = [];
		const handler = createSendmailCaptureSpawnHandler((message) => {
			captured.push(message);
		});

		const child = handler('/usr/sbin/sendmail -t', [], {});
		child.stderr.on('data', (data: ArrayBuffer) => {
			stderr.push(new TextDecoder().decode(data));
		});
		child.stdin.write(new Uint8Array(SENDMAIL_CAPTURE_MAX_SIZE + 1));
		child.stdin.end();
		const exitCode = await new Promise<number>((resolve) => {
			child.on('exit', (code: number) => resolve(code));
		});

		expect(exitCode).toBe(1);
		expect(captured).toHaveLength(0);
		expect(stderr.join('')).toContain(
			`Message size exceeds fixed maximum message size (${SENDMAIL_CAPTURE_MAX_SIZE})`
		);
	});
});
