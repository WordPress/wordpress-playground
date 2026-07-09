import {
	enableMailCapture,
	PHP,
	setPhpIniEntries,
	sandboxedSpawnHandlerFactory,
	SupportedPHPVersions,
} from '@php-wasm/universal';
import type { RawSendmailMessage } from '@php-wasm/util';
import { loadNodeRuntime } from '../lib';

const phpVersions =
	'PHP' in process.env ? [process.env['PHP']!] : SupportedPHPVersions;

const SENDMAIL_PROC_OPEN_CODE = `<?php
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
`;

describe.each(phpVersions)('PHP %s - raw mail capture', (phpVersion) => {
	let php: PHP;
	let messages: RawSendmailMessage[];

	beforeEach(async () => {
		messages = [];
		php = new PHP(await loadNodeRuntime(phpVersion as any));
		await setPhpIniEntries(php, {
			disable_functions: '',
		});
	}, 30_000);

	afterEach(() => {
		php?.exit();
	});

	it('captures raw bytes sent via mail()', async () => {
		await enableMailCapture(php, {
			onSendmail: (message) => {
				messages.push(message);
			},
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
		expect(messages).toHaveLength(1);
		expect(messages[0].text).toContain('From: sender@test.com');
		expect(messages[0].text).toContain('To: recipient@test.com');
		expect(messages[0].text).toContain('Subject: Raw subject');
		expect(messages[0].text).toContain('Raw body.');
		expect(messages[0].rawSize).toBe(messages[0].bytes.byteLength);
	});

	it('captures raw bytes sent to sendmail stdin', async () => {
		await enableMailCapture(php, {
			onSendmail: (message) => {
				messages.push(message);
			},
		});

		const result = await php.run({ code: SENDMAIL_PROC_OPEN_CODE });

		expect(result.text).toBe('SENT');
		expect(messages).toHaveLength(1);
		expect(messages[0].command).toContain('-fsender@test.com');
		expect(messages[0].text).toContain('Subject: Raw proc_open');
		expect(messages[0].text).toContain('Raw proc_open body.');
	});

	it('captures sendmail when enabled on top of a spawn handler', async () => {
		await php.setSpawnHandler(
			sandboxedSpawnHandlerFactory(async () => ({
				php,
				reap: () => {},
			}))
		);
		await enableMailCapture(php, {
			onSendmail: (message) => {
				messages.push(message);
			},
		});

		const result = await php.run({ code: SENDMAIL_PROC_OPEN_CODE });

		expect(result.text).toBe('SENT');
		expect(messages).toHaveLength(1);
		expect(messages[0].command).toContain('-fsender@test.com');
		expect(messages[0].text).toContain('Subject: Raw proc_open');
	});

	it('returns an error when sendmail receives no stdin bytes', async () => {
		await enableMailCapture(php, {
			onSendmail: (message) => {
				messages.push(message);
			},
		});

		const result = await php.run({
			code: `<?php
				error_reporting(E_ALL);
				$proc = proc_open(
					'/usr/sbin/sendmail -t -i -fsender@test.com',
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
				echo 'EXIT_' . $exit . ':' . $stderr;
			`,
		});

		expect(result.text).toContain('EXIT_75:sendmail: fatal:');
		expect(result.text).toContain('No message bytes received over stdin');
		expect(messages).toHaveLength(0);
	});
});
