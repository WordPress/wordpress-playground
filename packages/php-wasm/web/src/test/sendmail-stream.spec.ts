import test from '@playwright/test';

test.describe('sendmail stdin streaming', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', (log) => console.log(log.text()));
		await page.goto('/');
		await page.addScriptTag({
			type: 'module',
			url: '/src/test/playwright/browser-globals.ts',
		});
	});

	test('streams sendmail stdin in the browser before PHP run completes', async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const worker = await window.spawnPHPWorkerThread(
				window.sendmailWorkerUrl
			);
			const php = window.consumeAPI<{
				isReady(): Promise<void>;
				addEventListener(
					eventType: string,
					listener: (event: {
						type: string;
						stdin: ReadableStream<Uint8Array>;
					}) => void
				): Promise<void>;
				run(request: { code: string }): Promise<{ text: string }>;
				exit(): Promise<void>;
			}>(worker);
			await php.isReady();

			let runFinished = false;
			let eventFiredBeforeRunFinished = false;
			let chunkReadBeforeRunFinished = false;
			let secondListenerStreamBytesPromise: Promise<number> | undefined;
			let streamStatsPromise:
				| Promise<{
						bytes: number;
						chunks: number;
						startsWithHeaders: boolean;
				  }>
				| undefined;

			await php.addEventListener('sendmail.spawned', (event) => {
				if (event.type !== 'sendmail.spawned') {
					return;
				}
				eventFiredBeforeRunFinished = !runFinished;
				streamStatsPromise = (async () => {
					const reader = event.stdin.getReader();
					const decoder = new TextDecoder();
					let bytes = 0;
					let chunks = 0;
					let prefix = '';
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							break;
						}
						chunkReadBeforeRunFinished ||= !runFinished;
						bytes += value.byteLength;
						chunks++;
						if (prefix.length < 128) {
							prefix += decoder.decode(value, { stream: true });
						}
					}
					return {
						bytes,
						chunks,
						startsWithHeaders: prefix.startsWith(
							'From: sender@test.com\r\nTo: recipient@test.com'
						),
					};
				})();
			});
			await php.addEventListener('sendmail.spawned', (event) => {
				if (event.type !== 'sendmail.spawned') {
					return;
				}
				secondListenerStreamBytesPromise = (async () => {
					const reader = event.stdin.getReader();
					let bytes = 0;
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							return bytes;
						}
						bytes += value.byteLength;
					}
				})();
			});

			try {
				const response = await php.run({
					code: `<?php
						$proc = proc_open(
							'/usr/sbin/sendmail -t',
							[['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']],
							$pipes
						);
						usleep(500000);
						fwrite($pipes[0], "From: sender@test.com\r\n");
						fwrite($pipes[0], "To: recipient@test.com\r\n");
						fwrite($pipes[0], "Subject: Streamed browser mail\r\n\r\n");
						for ($i = 0; $i < 512; $i++) {
							fwrite($pipes[0], str_repeat('x', 1024));
						}
						fclose($pipes[0]);
						$exit = proc_close($proc);
						echo $exit === 0 ? 'SENT' : 'EXIT_' . $exit;
					`,
				});
				runFinished = true;

				return {
					text: response.text,
					eventFiredBeforeRunFinished,
					chunkReadBeforeRunFinished,
					streamStats: await streamStatsPromise,
					secondListenerStreamBytes:
						await secondListenerStreamBytesPromise,
				};
			} finally {
				await php.exit();
				worker.terminate();
			}
		});

		test.expect(result.text).toBe('SENT');
		test.expect(result.eventFiredBeforeRunFinished).toBe(true);
		test.expect(result.chunkReadBeforeRunFinished).toBe(true);
		test.expect(result.streamStats?.startsWithHeaders).toBe(true);
		test.expect(result.streamStats?.bytes).toBeGreaterThan(512 * 1024);
		test.expect(result.streamStats?.chunks).toBeGreaterThan(1);
		test.expect(result.secondListenerStreamBytes).toBeGreaterThan(
			512 * 1024
		);
	});

	test('keeps sendmail running when the listener cancels stdin', async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			const worker = await window.spawnPHPWorkerThread(
				window.sendmailWorkerUrl
			);
			const php = window.consumeAPI<{
				isReady(): Promise<void>;
				addEventListener(
					eventType: string,
					listener: (event: {
						type: string;
						stdin: ReadableStream<Uint8Array>;
					}) => void
				): Promise<void>;
				run(request: { code: string }): Promise<{ text: string }>;
				exit(): Promise<void>;
			}>(worker);
			await php.isReady();

			let resolveCancellation!: () => void;
			const cancellation = new Promise<void>((resolve) => {
				resolveCancellation = resolve;
			});
			await php.addEventListener('sendmail.spawned', (event) => {
				if (event.type === 'sendmail.spawned') {
					event.stdin.cancel().then(resolveCancellation);
				}
			});

			try {
				const response = await php.run({
					code: `<?php
						$proc = proc_open(
							'/usr/sbin/sendmail -t',
							[['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']],
							$pipes
						);
						fwrite($pipes[0], "Subject: Cancelled stream\r\n\r\n");
						usleep(1000000);
						fwrite($pipes[0], "Sendmail must keep accepting stdin.");
						fclose($pipes[0]);
						$exit = proc_close($proc);
						echo $exit === 0 ? 'SENT' : 'EXIT_' . $exit;
					`,
				});
				await cancellation;
				return response.text;
			} finally {
				await php.exit();
				worker.terminate();
			}
		});

		test.expect(result).toBe('SENT');
	});
});
