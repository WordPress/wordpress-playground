import { exposeAPI } from '@php-wasm/universal';

const originalPostMessage = MessagePort.prototype.postMessage;
let transferredReadableStream = false;
MessagePort.prototype.postMessage = function (
	message: unknown,
	optionsOrTransfer?: StructuredSerializeOptions | Transferable[]
) {
	const transfer = Array.isArray(optionsOrTransfer)
		? optionsOrTransfer
		: (optionsOrTransfer?.transfer ?? []);
	if (transfer.some((value) => value instanceof ReadableStream)) {
		transferredReadableStream = true;
	}
	return originalPostMessage.call(
		this,
		message,
		optionsOrTransfer as StructuredSerializeOptions
	);
};

const [setReady] = exposeAPI({
	getStream() {
		return new Blob(['stream from iframe']).stream();
	},
	wasStreamTransferred() {
		return transferredReadableStream;
	},
});
setReady();
