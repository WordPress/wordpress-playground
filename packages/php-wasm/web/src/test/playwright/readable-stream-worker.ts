import { exposeAPI, PHPWorker } from '@php-wasm/universal';

self.postMessage('worker-script-started');

class ReadableStreamWorker extends PHPWorker {
	#streamFinished = true;

	emitStream() {
		this.#streamFinished = false;
		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			start: (controller) => {
				controller.enqueue(encoder.encode('first chunk'));
				setTimeout(() => {
					controller.enqueue(encoder.encode('second chunk'));
					controller.close();
					this.#streamFinished = true;
				}, 500);
			},
		});
		this.dispatchEvent({ type: 'test.stream', stdin: stream });
	}

	isStreamFinished() {
		return this.#streamFinished;
	}
}

const endpoint = new ReadableStreamWorker();
const [setApiReady] = exposeAPI(endpoint);
setApiReady();
