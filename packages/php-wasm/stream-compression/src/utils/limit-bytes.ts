/**
 * Limit the number of bytes read from a stream.
 *
 * @param stream The stream to limit.
 * @param bytes The number of bytes to read from the stream.
 * @returns A new stream that will read at most `bytes` bytes from `stream`.
 */
export function limitBytes(stream: ReadableStream<Uint8Array>, bytes: number) {
	if (bytes === 0) {
		return new ReadableStream({
			start(controller) {
				controller.close();
			},
		});
	}
	const reader = stream.getReader({ mode: 'byob' });
	let offset = 0;

	let buffer = new ArrayBuffer(bytes);
	return new ReadableStream({
		async pull(controller) {
			const { value: view, done } = await reader.read(
				new Uint8Array(buffer!, 0, bytes - offset)
			);
			if (done) {
				reader.releaseLock();
				controller.close();
				return;
			}
			buffer = view.buffer;
			offset += view.length;
			controller.enqueue(view);

			if (offset >= bytes) {
				reader.releaseLock();
				controller.close();
			}
		},
		cancel() {
			reader.cancel();
		},
	});
}
