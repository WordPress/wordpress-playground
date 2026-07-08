import { PHP, setPhpIniEntries } from '@php-wasm/universal';
import type { RawSendmailMessage } from '@php-wasm/util';
import { loadNodeRuntime } from '../lib';

const phpVersions = ['8.4'];

describe.each(phpVersions)('PHP %s - raw mail capture', (phpVersion) => {
	let php: PHP;
	let messages: RawSendmailMessage[];

	beforeEach(async () => {
		messages = [];
		php = new PHP(
			await loadNodeRuntime(phpVersion as any, {
				withMailCapture: {
					onSendmail: (message) => {
						messages.push(message);
					},
				},
			})
		);
		await setPhpIniEntries(php, {
			disable_functions: '',
		});
	}, 30_000);

	afterEach(() => {
		php?.exit();
	});

	it('captures raw bytes sent via mail()', async () => {
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
		expect(messages).toHaveLength(1);
		expect(messages[0].text).toContain('From: sender@test.com');
		expect(messages[0].text).toContain('To: recipient@test.com');
		expect(messages[0].text).toContain('Subject: Raw subject');
		expect(messages[0].text).toContain('Raw body.');
		expect(messages[0].rawSize).toBe(messages[0].bytes.byteLength);
	});

	it('captures raw bytes sent to sendmail stdin', async () => {
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
		expect(messages).toHaveLength(1);
		expect(messages[0].command).toContain('-fsender@test.com');
		expect(messages[0].envelopeSender).toBe('sender@test.com');
		expect(messages[0].text).toContain('Subject: Raw proc_open');
		expect(messages[0].text).toContain('Raw proc_open body.');
	});
});
