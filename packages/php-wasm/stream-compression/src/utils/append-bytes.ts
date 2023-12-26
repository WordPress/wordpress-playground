/**
 * Appends bytes to a stream.
 *
 * @param bytes The bytes to append.
 * @returns A transform stream that will append the specified bytes.
 */
export function appendBytes(bytes: Uint8Array) {
	return new TransformStream<Uint8Array, Uint8Array>({
		async transform(chunk, controller) {
			controller.enqueue(chunk);
		},
		async flush(controller) {
			controller.enqueue(bytes);
		},
	});
}
