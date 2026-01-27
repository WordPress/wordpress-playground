import { cloneStreamMonitorProgress } from '../lib/emscripten-download-monitor';

function createChunkyStream(
	chunks: number,
	chunkSize: number
): ReadableStream<Uint8Array> {
	let emitted = 0;

	return new ReadableStream({
		pull(controller) {
			if (emitted >= chunks) {
				controller.close();
				return;
			}

			emitted++;
			controller.enqueue(new Uint8Array(chunkSize));
		},
	});
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('cloneStreamMonitorProgress throttling', () => {
	it('throttles progress events for tiny ReadableStream chunks (Safari)', async () => {
		let now = 0;

		vi.spyOn(performance, 'now').mockImplementation(() => now);

		const onProgress = vi.fn();

		const stream = createChunkyStream(100, 10);

		const monitored = cloneStreamMonitorProgress(stream, 1000, onProgress);

		const reader = monitored.getReader();

		while (true) {
			const { done } = await reader.read();
			if (done) break;

			now += 10;
		}

		const lastEvent =
			onProgress.mock.calls[onProgress.mock.calls.length - 1][0];

		expect(onProgress).toHaveBeenCalled();
		expect(onProgress.mock.calls.length).toBeLessThanOrEqual(3);
		expect(lastEvent.detail.loaded).toBe(1000);
		expect(lastEvent.detail.total).toBe(1000);
	});
});
