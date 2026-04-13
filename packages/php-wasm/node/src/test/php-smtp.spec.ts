import { PHP, setPhpIniEntries } from '@php-wasm/universal';
import type { CaughtMessage } from '@php-wasm/util';
import { loadNodeRuntime } from '../lib';

const phpVersions = ['8.4'];
// TODO re-enable testing on all versions before merging
// 'PHP' in process.env
// 	? [process.env['PHP']! as SupportedPHPVersion]
// 	: SupportedPHPVersions;

describe.each(phpVersions)('PHP %s – SMTP sink', (phpVersion) => {
	let php: PHP;
	let emails: CaughtMessage[];

	beforeEach(async () => {
		emails = [];
		php = new PHP(
			await loadNodeRuntime(phpVersion as any, {
				withSMTPSink: {
					port: 25,
					onEmail: (m: CaughtMessage) => emails.push(m),
				},
			})
		);
		await setPhpIniEntries(php, {
			disable_functions: '',
			allow_url_fopen: 1,
		});
	}, 30_000);

	afterEach(() => {
		php?.exit();
	});

	it('captures an email piped via proc_open to sendmail', async () => {
		const result = await php.run({
			code: `<?php
				error_reporting(E_ALL);
				$email = "From: sender@test.com\r\nTo: recipient@test.com\r\nSubject: Hello from PHP\r\n\r\nThis is the body.";
				$proc = proc_open(
					'/usr/sbin/sendmail -t -i',
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
		expect(emails).toHaveLength(1);
		expect(emails[0].from).toContain('sender@test.com');
		expect(emails[0].to).toContain('recipient@test.com');
		expect(emails[0].subject).toBe('Hello from PHP');
		expect(emails[0].text?.trim()).toBe('This is the body.');
	});

	it('captures an email sent via fsockopen SMTP', async () => {
		const result = await php.run({
			code: `<?php
				error_reporting(E_ALL);

				function smtp_read_reply($fp) {
					$lines = '';
					while (($line = fgets($fp)) !== false) {
						$lines .= $line;
						if (preg_match('/^\\d{3} /', $line)) break;
					}
					return $lines;
				}

				$smtp = fsockopen('localhost', 25, $errno, $errstr, 5);
				if (!$smtp) { echo "CONNECT_FAILED: $errstr ($errno)"; exit; }

				smtp_read_reply($smtp);
				fwrite($smtp, "EHLO localhost\\r\\n");
				smtp_read_reply($smtp);
				fwrite($smtp, "MAIL FROM:<sender@test.com>\\r\\n");
				smtp_read_reply($smtp);
				fwrite($smtp, "RCPT TO:<recipient@test.com>\\r\\n");
				smtp_read_reply($smtp);
				fwrite($smtp, "DATA\\r\\n");
				smtp_read_reply($smtp);
				fwrite($smtp, "From: sender@test.com\\r\\n");
				fwrite($smtp, "To: recipient@test.com\\r\\n");
				fwrite($smtp, "Subject: Hello via SMTP\\r\\n");
				fwrite($smtp, "\\r\\n");
				fwrite($smtp, "This is the body.\\r\\n");
				fwrite($smtp, ".\\r\\n");
				smtp_read_reply($smtp);
				fwrite($smtp, "QUIT\\r\\n");
				fclose($smtp);
				echo 'SENT';
			`,
		});

		expect(result.text).toBe('SENT');
		expect(emails).toHaveLength(1);
		expect(emails[0].from).toContain('sender@test.com');
		expect(emails[0].to).toContain('recipient@test.com');
		expect(emails[0].subject).toBe('Hello via SMTP');
		expect(emails[0].text?.trim()).toBe('This is the body.');
	});

	it('captures an email sent via mail()', async () => {
		const result = await php.run({
			code: `<?php
				error_reporting(E_ALL);
				$result = mail(
					'recipient@test.com',
					'Hello from PHP',
					'This is the body.',
					'From: sender@test.com'
				);
				echo $result ? 'SENT' : 'FAILED';
			`,
		});

		expect(result.text).toBe('SENT');
		expect(emails).toHaveLength(1);
		expect(emails[0].from).toContain('sender@test.com');
		expect(emails[0].to).toContain('recipient@test.com');
		expect(emails[0].subject).toBe('Hello from PHP');
		expect(emails[0].text?.trim()).toBe('This is the body.');
	});
});
