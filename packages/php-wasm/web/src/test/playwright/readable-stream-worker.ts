import { exposeAPI, PHPWorker } from '@php-wasm/universal';

self.postMessage('worker-script-started');

class ReadableStreamWorker extends PHPWorker {
	#streamFinished = true;
	#transferableStreamProbeRejected = false;

	emitStream(forceMessagePortFallback = false) {
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
		const originalPostMessage = MessagePort.prototype.postMessage;
		let transferableStreamProbeRejected = false;
		if (forceMessagePortFallback) {
			/**
			 * Emulates a runtime without transferable streams. The production feature
			 * detection must reject the probe and select the MessagePort bridge.
			 */
			MessagePort.prototype.postMessage = function (
				this: MessagePort,
				message: unknown,
				optionsOrTransfer: StructuredSerializeOptions | Transferable[]
			) {
				if (message instanceof ReadableStream) {
					transferableStreamProbeRejected = true;
					throw new DOMException(
						'Transferable streams disabled by test',
						'DataCloneError'
					);
				}
				const options = Array.isArray(optionsOrTransfer)
					? { transfer: optionsOrTransfer }
					: optionsOrTransfer;
				return originalPostMessage.call(this, message, options);
			} as MessagePort['postMessage'];
		}

		try {
			this.dispatchEvent({ type: 'test.stream', stdin: stream });
		} finally {
			MessagePort.prototype.postMessage = originalPostMessage;
			this.#transferableStreamProbeRejected =
				transferableStreamProbeRejected;
		}
	}

	isStreamFinished() {
		return this.#streamFinished;
	}

	wasTransferableStreamProbeRejected() {
		return this.#transferableStreamProbeRejected;
	}
}

const endpoint = new ReadableStreamWorker();
const [setApiReady] = exposeAPI(endpoint);
setApiReady();
