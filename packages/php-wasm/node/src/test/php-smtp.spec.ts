import { PHP, setPhpIniEntries } from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';
import type { CaughtMessage } from '@php-wasm/util';
import { readFileSync } from 'fs';
import { loadNodeRuntime } from '../lib';

const phpVersions = ['8.4'];
const attachmentFilename = 'image.jpg';
const attachmentPath = `/tmp/${attachmentFilename}`;
const attachmentContent = readFileSync(
	joinPaths(__dirname, 'test-data', attachmentFilename)
);
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
					smtpPort: 25,
					onEmail: (m: CaughtMessage) => emails.push(m),
				},
			})
		);
		await setPhpIniEntries(php, {
			disable_functions: '',
			allow_url_fopen: 1,
		});
		php.writeFile(attachmentPath, attachmentContent);
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

	it('captures an attachment from a MIME message sent via mail()', async () => {
		const result = await php.run({
			code: `<?php
				error_reporting(E_ALL);
				$attachment = file_get_contents('${attachmentPath}');
				if ($attachment === false) {
					echo 'ATTACHMENT_READ_FAILED';
					exit;
				}
				$body = "--MIXBOUND\r\n"
					. "Content-Type: text/plain; charset=utf-8\r\n"
					. "\r\n"
					. "Body text.\r\n"
					. "--MIXBOUND\r\n"
					. "Content-Type: image/jpeg; name=\\"${attachmentFilename}\\"\r\n"
					. "Content-Transfer-Encoding: base64\r\n"
					. "Content-Disposition: attachment; filename=\\"${attachmentFilename}\\"\r\n"
					. "\r\n"
					. chunk_split(base64_encode($attachment), 76, "\r\n")
					. "--MIXBOUND--\r\n";
				$headers = "From: sender@test.com\r\n"
					. "MIME-Version: 1.0\r\n"
					. "Content-Type: multipart/mixed; boundary=\\"MIXBOUND\\"";
				$result = mail(
					'recipient@test.com',
					'With attachment',
					$body,
					$headers
				);
				echo $result ? 'SENT' : 'FAILED';
			`,
		});

		expect(result.text).toBe('SENT');
		expect(emails).toHaveLength(1);
		expect(emails[0].text?.trim()).toBe('Body text.');
		expect(emails[0].attachments).toHaveLength(1);
		const attachment = emails[0].attachments[0];
		expect(attachment.filename).toBe(attachmentFilename);
		expect(attachment.contentType).toBe('image/jpeg');
		expect(attachment.contentDisposition).toBe('attachment');
		expect(attachment.content).toEqual(new Uint8Array(attachmentContent));
		expect(attachment.size).toBe(attachmentContent.length);
	});

	it('captures an attachment from a MIME message sent via fsockopen SMTP', async () => {
		const result = await php.run({
			code: `<?php
				error_reporting(E_ALL);
				$attachment = file_get_contents('${attachmentPath}');
				if ($attachment === false) {
					echo 'ATTACHMENT_READ_FAILED';
					exit;
				}

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
				fwrite($smtp, "Subject: With attachment\\r\\n");
				fwrite($smtp, "MIME-Version: 1.0\\r\\n");
				fwrite($smtp, "Content-Type: multipart/mixed; boundary=\\"MIXBOUND\\"\\r\\n");
				fwrite($smtp, "\\r\\n");
				fwrite($smtp, "--MIXBOUND\\r\\n");
				fwrite($smtp, "Content-Type: text/plain; charset=utf-8\\r\\n");
				fwrite($smtp, "\\r\\n");
				fwrite($smtp, "Body text.\\r\\n");
				fwrite($smtp, "--MIXBOUND\\r\\n");
				fwrite($smtp, "Content-Type: image/jpeg; name=\\"${attachmentFilename}\\"\\r\\n");
				fwrite($smtp, "Content-Transfer-Encoding: base64\\r\\n");
				fwrite($smtp, "Content-Disposition: attachment; filename=\\"${attachmentFilename}\\"\\r\\n");
				fwrite($smtp, "\\r\\n");
				fwrite($smtp, chunk_split(base64_encode($attachment), 76, "\\r\\n"));
				fwrite($smtp, "--MIXBOUND--\\r\\n");
				fwrite($smtp, ".\\r\\n");
				smtp_read_reply($smtp);
				fwrite($smtp, "QUIT\\r\\n");
				fclose($smtp);
				echo 'SENT';
			`,
		});

		expect(result.text).toBe('SENT');
		expect(emails).toHaveLength(1);
		expect(emails[0].text?.trim()).toBe('Body text.');
		expect(emails[0].attachments).toHaveLength(1);
		const attachment = emails[0].attachments[0];
		expect(attachment.filename).toBe(attachmentFilename);
		expect(attachment.contentType).toBe('image/jpeg');
		expect(attachment.contentDisposition).toBe('attachment');
		expect(attachment.content).toEqual(new Uint8Array(attachmentContent));
		expect(attachment.size).toBe(attachmentContent.length);
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
