import test from '@playwright/test';

test.describe('readable stream transfer', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.addScriptTag({
			type: 'module',
			url: '/src/test/playwright/browser-globals.ts',
		});
	});

	test('keeps Window API streams away from isolated-world listeners', async ({
		page,
	}) => {
		const cdp = await page.context().newCDPSession(page);
		const frameTree = await cdp.send('Page.getFrameTree');
		const isolatedWorld = await cdp.send('Page.createIsolatedWorld', {
			frameId: frameTree.frameTree.frame.id,
			worldName: 'window-stream-observer',
		});
		await cdp.send('Runtime.evaluate', {
			contextId: isolatedWorld.executionContextId,
			expression: `
				window.addEventListener('message', (event) => {
					void event.data;
				});
			`,
		});

		const result = await page.evaluate(async () => {
			type WindowAPI = {
				isReady(): Promise<void>;
				getStream(): Promise<ReadableStream<Uint8Array>>;
				wasStreamTransferred(): Promise<boolean>;
			};

			const iframe = document.createElement('iframe');
			iframe.src = '/src/test/playwright/window-api-frame.html';
			document.body.appendChild(iframe);

			const withTimeout = <T>(promise: Promise<T>) =>
				Promise.race([
					promise,
					new Promise<never>((_, reject) =>
						setTimeout(
							() =>
								reject(
									new Error(
										'Window API stream did not arrive'
									)
								),
							5000
						)
					),
				]);

			try {
				const api = window.consumeAPI<WindowAPI>(iframe.contentWindow!);
				await withTimeout(api.isReady());
				const stream = await withTimeout(api.getStream());
				return {
					text: await withTimeout(new Response(stream).text()),
					transferredReadableStream: await withTimeout(
						api.wasStreamTransferred()
					),
				};
			} finally {
				iframe.remove();
			}
		});

		test.expect(result).toEqual({
			text: 'stream from iframe',
			transferredReadableStream: true,
		});
	});

	for (const forceMessagePortFallback of [false, true]) {
		const transport = forceMessagePortFallback
			? 'the MessagePort fallback'
			: 'transferable streams';
		test(`streams stdin to every listener through ${transport}`, async ({
			page,
		}) => {
			const result = await page.evaluate(
				async (forceMessagePortFallback) => {
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
						emitStream(
							forceMessagePortFallback: boolean
						): Promise<void>;
						isStreamFinished(): Promise<boolean>;
						wasTransferableStreamProbeRejected(): Promise<boolean>;
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
					const secondStream = new Promise<
						ReadableStream<Uint8Array>
					>((resolve) => (resolveSecondStream = resolve));

					await api.addEventListener('test.stream', (event) => {
						resolveFirstStream(event.stdin);
					});
					await api.addEventListener('test.stream', (event) => {
						resolveSecondStream(event.stdin);
					});

					try {
						await api.emitStream(forceMessagePortFallback);
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
							chunksB: chunksB.map((chunk) =>
								decoder.decode(chunk)
							),
							sourceFinishedAfterFirstRead,
							transferableStreamProbeRejected:
								await api.wasTransferableStreamProbeRejected(),
						};
					} finally {
						worker.terminate();
					}
				},
				forceMessagePortFallback
			);

			test.expect(result.firstChunk).toBe('first chunk');
			test.expect(result.remainingA).toEqual(['second chunk']);
			test.expect(result.chunksB).toEqual([
				'first chunk',
				'second chunk',
			]);
			test.expect(result.sourceFinishedAfterFirstRead).toBe(false);
			test.expect(result.transferableStreamProbeRejected).toBe(
				forceMessagePortFallback
			);
		});
	}

	for (const forceMessagePortFallback of [false, true]) {
		const transport = forceMessagePortFallback
			? 'the MessagePort fallback'
			: 'transferable streams';
		test(`cancels the source through ${transport}`, async ({ page }) => {
			const result = await page.evaluate(
				async (forceMessagePortFallback) => {
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
						emitStream(
							forceMessagePortFallback: boolean,
							secondChunkDelay: number
						): Promise<void>;
						wasStreamCancelled(): Promise<boolean>;
						wasTransferableStreamProbeRejected(): Promise<boolean>;
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
					const secondStream = new Promise<
						ReadableStream<Uint8Array>
					>((resolve) => (resolveSecondStream = resolve));
					await api.addEventListener('test.stream', (event) => {
						resolveFirstStream(event.stdin);
					});
					await api.addEventListener('test.stream', (event) => {
						resolveSecondStream(event.stdin);
					});

					try {
						await api.emitStream(forceMessagePortFallback, 5000);
						const streams = await Promise.all([
							firstStream,
							secondStream,
						]);
						await Promise.all(
							streams.map((stream) => stream.cancel())
						);

						const deadline = Date.now() + 2000;
						while (Date.now() < deadline) {
							if (await api.wasStreamCancelled()) {
								return {
									sourceCancelled: true,
									transferableStreamProbeRejected:
										await api.wasTransferableStreamProbeRejected(),
								};
							}
							await new Promise((resolve) =>
								setTimeout(resolve, 10)
							);
						}
						return {
							sourceCancelled: false,
							transferableStreamProbeRejected:
								await api.wasTransferableStreamProbeRejected(),
						};
					} finally {
						worker.terminate();
					}
				},
				forceMessagePortFallback
			);

			test.expect(result.transferableStreamProbeRejected).toBe(
				forceMessagePortFallback
			);
			test.expect(result.sourceCancelled).toBe(true);
		});
	}
});
