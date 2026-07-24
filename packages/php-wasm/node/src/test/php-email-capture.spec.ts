import {
	PHP,
	setPhpIniEntries,
	SupportedPHPVersions,
} from '@php-wasm/universal';
import {
	SENDMAIL_CAPTURE_MAX_SIZE,
	sendmailSpawnHandler,
} from '@php-wasm/util';
import type { PHPSendmailSpawnedEvent } from '@php-wasm/util';
import { loadNodeRuntime } from '../lib';

const phpVersions =
	'PHP' in process.env ? [process.env['PHP']!] : SupportedPHPVersions;

describe.each(phpVersions)('PHP %s - sendmail capture', (phpVersion) => {
	let php: PHP;
	let events: PHPSendmailSpawnedEvent[];

	beforeEach(async () => {
		events = [];
		php = new PHP(await loadNodeRuntime(phpVersion as any));
		php.setCommandSpawnHandler('sendmail', sendmailSpawnHandler(php));
		php.addEventListener('sendmail.spawned', (event) => {
			events.push(event as PHPSendmailSpawnedEvent);
		});
		await setPhpIniEntries(php, {
			disable_functions: '',
		});
	}, 30_000);

	afterEach(() => {
		php?.exit();
	});

	it('captures message sent to sendmail stdin via proc_open()', async () => {
		const result = await php.run({
			code: `<?php
				error_reporting(E_ALL);
				$email = "From: sender@test.com\\r\\n"
					. "To: recipient@test.com\\r\\n"
					. "Subject: Raw proc_open\\r\\n"
					. "\\r\\n"
					. "Raw proc_open body.";
				$proc = proc_open(
					'/usr/sbin/sendmail -t -i -fsender@test.com',
					[['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']],
					$pipes
				);
				if (!is_resource($proc)) {
					echo 'PROC_OPEN_FAILED';
					exit;
				}
				fwrite($pipes[0], $email);
				fclose($pipes[0]);
				$exit = proc_close($proc);
				echo $exit === 0 ? 'SENT' : 'EXIT_' . $exit;
		`,
		});

		expect(result.text).toBe('SENT');
		expect(events).toHaveLength(1);
		const message = await decodeStream(events[0].stdin);
		expect(message).toContain('Subject: Raw proc_open');
		expect(message).toContain('Raw proc_open body.');
	});

	it('waits for delayed sendmail stdin bytes', async () => {
		const result = await php.run({
			code: `<?php
				error_reporting(E_ALL);
				$proc = proc_open(
					'/usr/sbin/sendmail -t',
					[['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']],
					$pipes
				);
				if (!is_resource($proc)) {
					echo 'PROC_OPEN_FAILED';
					exit;
				}
				usleep(500000);
				fwrite($pipes[0], "Subject: Delayed proc_open\r\n\r\nDelayed body.");
				fclose($pipes[0]);
				$exit = proc_close($proc);
				echo $exit === 0 ? 'SENT' : 'EXIT_' . $exit;
		`,
		});

		expect(result.text).toBe('SENT');
		expect(events).toHaveLength(1);
		const message = await decodeStream(events[0].stdin);
		expect(message).toContain('Subject: Delayed proc_open');
		expect(message).toContain('Delayed body.');
	});

	it('exits 75 when sendmail receives no stdin bytes', async () => {
		const result = await php.run({
			code: `<?php
				error_reporting(E_ALL);
				$proc = proc_open(
					'/usr/sbin/sendmail -t',
					[['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']],
					$pipes
				);
				if (!is_resource($proc)) {
					echo 'PROC_OPEN_FAILED';
					exit;
				}
				fclose($pipes[0]);
				$stderr = stream_get_contents($pipes[2]);
				$exit = proc_close($proc);
				echo json_encode(['exit' => $exit, 'stderr' => $stderr]);
		`,
		});

		const data = result.json;
		expect(data).toEqual({
			exit: 75,
			stderr: 'sendmail: fatal: No message bytes received over stdin\n',
		});
		expect(events).toHaveLength(0);
	});

	it('rejects messages larger than the fixed capture limit', async () => {
		const result = await php.run({
			code: `<?php
				error_reporting(E_ALL);
				$proc = proc_open(
					'/usr/sbin/sendmail -t',
					[['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']],
					$pipes
				);
				if (!is_resource($proc)) {
					echo 'PROC_OPEN_FAILED';
					exit;
				}
				fwrite($pipes[0], str_repeat('a', ${SENDMAIL_CAPTURE_MAX_SIZE + 1}));
				fclose($pipes[0]);
				$stderr = stream_get_contents($pipes[2]);
				$exit = proc_close($proc);
				echo json_encode(['exit' => $exit, 'stderr' => $stderr]);
		`,
		});

		const data = result.json;
		expect(data).toEqual({
			exit: 1,
			stderr: `sendmail: Message size exceeds fixed maximum message size (${SENDMAIL_CAPTURE_MAX_SIZE})\n`,
		});
		expect(events).toHaveLength(1);
		await expect(decodeStream(events[0].stdin)).rejects.toThrow(
			`sendmail: Message size exceeds fixed maximum message size (${SENDMAIL_CAPTURE_MAX_SIZE})`
		);
	}, 30_000);

	it('should capture email after runtime rotation', async () => {
		await php.hotSwapPHPRuntime(await loadNodeRuntime(phpVersion as any));
		await setPhpIniEntries(php, {
			disable_functions: '',
		});

		const result = await php.run({
			code: `<?php
			error_reporting(E_ALL);
			$result = mail(
				'recipient@test.com',
				'Raw subject',
				'Raw body.',
				'From: sender@test.com'
			);
			echo $result ? 'SENT' : 'FAILED';
		`,
		});

		expect(result.text).toBe('SENT');
		expect(events).toHaveLength(1);
		const message = await decodeStream(events[0].stdin);
		expect(message).toContain('Subject: Raw subject');
		expect(message).toContain('Raw body.');
	});
});

async function decodeStream(stream: ReadableStream<Uint8Array>) {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let text = '';
	while (true) {
		const { value, done } = await reader.read();
		if (done) {
			return text;
		}
		text += decoder.decode(value, { stream: true });
	}
}
