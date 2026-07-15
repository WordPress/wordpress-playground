import test from '@playwright/test';

test.describe('ReadableStream worker transfer', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.addScriptTag({
			type: 'module',
			url: '/src/test/playwright/browser-globals.ts',
		});
	});

	test('streams an event payload to every listener before the source closes', async ({
		page,
	}) => {
		const result = await page.evaluate(async () => {
			type StreamEvent = {
				type: string;
				stdin: ReadableStream<Uint8Array>;
			};
			type WorkerAPI = {
				isReady(): Promise<void>;
				addEventListener(
					eventType: string,
					listener: (event: StreamEvent) => void
				): Promise<void>;
				emitStream(): Promise<void>;
				isStreamFinished(): Promise<boolean>;
			};

			const worker = await window.spawnPHPWorkerThread(
				window.readableStreamWorkerUrl
			);
			const api = window.consumeAPI<WorkerAPI>(worker);
			await api.isReady();

			let resolveFirstStream!: (
				stream: ReadableStream<Uint8Array>
			) => void;
			let resolveSecondStream!: (
				stream: ReadableStream<Uint8Array>
			) => void;
			const firstStream = new Promise<ReadableStream<Uint8Array>>(
				(resolve) => (resolveFirstStream = resolve)
			);
			const secondStream = new Promise<ReadableStream<Uint8Array>>(
				(resolve) => (resolveSecondStream = resolve)
			);

			await api.addEventListener('test.stream', (event) => {
				resolveFirstStream(event.stdin);
			});
			await api.addEventListener('test.stream', (event) => {
				resolveSecondStream(event.stdin);
			});

			try {
				await api.emitStream();
				const [streamA, streamB] = await Promise.race([
					Promise.all([firstStream, secondStream]),
					new Promise<never>((_, reject) =>
						setTimeout(
							() =>
								reject(
									new Error(
										'Stream event was not transferred'
									)
								),
							2000
						)
					),
				]);

				const readerA = streamA.getReader();
				const firstRead = await readerA.read();
				const sourceFinishedAfterFirstRead =
					await api.isStreamFinished();

				const readRemaining = async (
					reader: ReadableStreamDefaultReader<Uint8Array>
				) => {
					const chunks: Uint8Array[] = [];
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							return chunks;
						}
						chunks.push(value);
					}
				};
				const [remainingA, chunksB] = await Promise.all([
					readRemaining(readerA),
					readRemaining(streamB.getReader()),
				]);
				const decoder = new TextDecoder();
				return {
					firstChunk: decoder.decode(firstRead.value),
					remainingA: remainingA.map((chunk) =>
						decoder.decode(chunk)
					),
					chunksB: chunksB.map((chunk) => decoder.decode(chunk)),
					sourceFinishedAfterFirstRead,
				};
			} finally {
				worker.terminate();
			}
		});

		test.expect(result.firstChunk).toBe('first chunk');
		test.expect(result.remainingA).toEqual(['second chunk']);
		test.expect(result.chunksB).toEqual(['first chunk', 'second chunk']);
		test.expect(result.sourceFinishedAfterFirstRead).toBe(false);
	});
});
