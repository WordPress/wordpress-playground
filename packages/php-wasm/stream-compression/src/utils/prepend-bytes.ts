/**
 * Prepend bytes to a stream.
 *
 * @param bytes The bytes to prepend.
 * @returns A transform stream that will prepend the specified bytes.
 */
export function prependBytes(bytes: Uint8Array) {
	let isPrepended = false;
	return new TransformStream<Uint8Array, Uint8Array>({
		async transform(chunk, controller) {
			if (!isPrepended) {
				isPrepended = true;
				controller.enqueue(bytes);
			}
			controller.enqueue(chunk);
		},
	});
}
