import { SENDMAIL_CAPTURE_MAX_SIZE } from '@php-wasm/util';
import { test, expect } from '../playground-fixtures';

test('forwards sendmail capture streams to the website UI thread', async ({
	website,
}) => {
	await website.goto('./?storage=temp');
	await website.page.waitForFunction(() =>
		Boolean((window as any).playgroundSites?.getClient())
	);

	const result = await website.page.evaluate(
		async ({ captureMaxSize }) => {
			const sitesApi = (window as any).playgroundSites;
			await sitesApi.isReady();
			const client = sitesApi.getClient();
			type CapturedStream = {
				text: string | null;
				error: string | null;
			};
			const capturedStreams: CapturedStream[] = [];
			const pendingReads = new Set<Promise<void>>();
			async function decodeStream(stream: ReadableStream<Uint8Array>) {
				const reader = stream.getReader();
				const decoder = new TextDecoder();
				let text = '';
				while (true) {
					const { value, done } = await reader.read();
					if (done) {
						return text + decoder.decode();
					}
					text += decoder.decode(value, { stream: true });
				}
			}

			await client.addEventListener(
				'sendmail.spawned',
				(event: {
					type: string;
					stdin: ReadableStream<Uint8Array>;
				}) => {
					if (event.type !== 'sendmail.spawned') {
						return;
					}
					const read = (async () => {
						try {
							capturedStreams.push({
								text: await decodeStream(event.stdin),
								error: null,
							});
						} catch (error) {
							capturedStreams.push({
								text: null,
								error:
									error instanceof Error
										? error.message
										: String(error),
							});
						}
					})();
					pendingReads.add(read);
					void read.finally(() => pendingReads.delete(read));
				}
			);

			async function requestPhpFile(
				filename: string,
				code: string,
				{ expectEvent = true }: { expectEvent?: boolean } = {}
			) {
				const captureStart = capturedStreams.length;
				await client.writeFile(`/wordpress/${filename}`, code);
				const response = await client.request({ url: `/${filename}` });

				if (expectEvent) {
					const timeoutAt = performance.now() + 60_000;
					while (
						capturedStreams.length === captureStart &&
						pendingReads.size === 0
					) {
						if (performance.now() > timeoutAt) {
							throw new Error(
								`Timed out waiting for sendmail event from ${filename}`
							);
						}
						await new Promise((resolve) =>
							window.setTimeout(resolve, 10)
						);
					}
					await Promise.all([...pendingReads]);
				} else {
					await new Promise((resolve) =>
						window.setTimeout(resolve, 250)
					);
				}

				// Allow any duplicate callback from the same PHP dispatch to settle so
				// the exact event count remains part of the end-to-end contract.
				await new Promise((resolve) => window.setTimeout(resolve, 50));
				await Promise.all([...pendingReads]);
				return {
					responseText: response.text,
					captures: capturedStreams.slice(captureStart),
				};
			}

			const raw = await requestPhpFile(
				'raw-proc-open.php',
				`<?php
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
			`
			);

			const delayed = await requestPhpFile(
				'delayed-proc-open.php',
				`<?php
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
			`
			);

			const oversized = await requestPhpFile(
				'oversized-proc-open.php',
				`<?php
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
				fwrite($pipes[0], str_repeat('a', ${captureMaxSize + 1}));
				fclose($pipes[0]);
				$stderr = stream_get_contents($pipes[2]);
				$exit = proc_close($proc);
				echo json_encode(['exit' => $exit, 'stderr' => $stderr]);
			`
			);

			const mail = await requestPhpFile(
				'mail-function.php',
				`<?php
				error_reporting(E_ALL);
				$result = mail(
					'recipient@test.com',
					'HTTP mail subject',
					'HTTP mail body.',
					'From: sender@test.com'
				);
				echo $result ? 'SENT' : 'FAILED';
			`
			);

			const empty = await requestPhpFile(
				'empty-proc-open.php',
				`<?php
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
				{ expectEvent: false }
			);

			return { raw, delayed, oversized, mail, empty };
		},
		{ captureMaxSize: SENDMAIL_CAPTURE_MAX_SIZE }
	);

	expect(result.raw.responseText).toBe('SENT');
	expect(result.raw.captures).toHaveLength(1);
	expect(result.raw.captures[0]).toEqual({
		text: expect.stringContaining('Subject: Raw proc_open'),
		error: null,
	});
	expect(result.raw.captures[0].text).toContain('Raw proc_open body.');

	expect(result.delayed.responseText).toBe('SENT');
	expect(result.delayed.captures).toHaveLength(1);
	expect(result.delayed.captures[0]).toEqual({
		text: expect.stringContaining('Subject: Delayed proc_open'),
		error: null,
	});
	expect(result.delayed.captures[0].text).toContain('Delayed body.');

	expect(JSON.parse(result.oversized.responseText)).toEqual({
		exit: 1,
		stderr: `sendmail: Message size exceeds fixed maximum message size (${SENDMAIL_CAPTURE_MAX_SIZE})\n`,
	});
	expect(result.oversized.captures).toHaveLength(1);
	expect(result.oversized.captures[0].text).toBeNull();
	expect(result.oversized.captures[0].error).toContain(
		`sendmail: Message size exceeds fixed maximum message size (${SENDMAIL_CAPTURE_MAX_SIZE})`
	);

	expect(result.mail.responseText).toBe('SENT');
	expect(result.mail.captures).toHaveLength(1);
	expect(result.mail.captures[0]).toEqual({
		text: expect.stringContaining('Subject: HTTP mail subject'),
		error: null,
	});
	expect(result.mail.captures[0].text).toContain('HTTP mail body.');

	expect(JSON.parse(result.empty.responseText)).toEqual({
		exit: 75,
		stderr: 'sendmail: fatal: No message bytes received over stdin\n',
	});
	expect(result.empty.captures).toHaveLength(0);
});
