/**
 * Skips the first `length` bytes of a stream.
 *
 * @param length The number of bytes to skip.
 * @returns A transform stream that will skip the specified number of bytes.
 */
export function skipFirstBytes(length: number) {
	let totalBytesSkipped = 0;
	return new TransformStream<Uint8Array, Uint8Array>({
		async transform(chunk, controller) {
			if (totalBytesSkipped + chunk.byteLength < length) {
				totalBytesSkipped += chunk.byteLength;
				return;
			}

			const bytesToSkip = length - totalBytesSkipped;
			totalBytesSkipped = length;
			controller.enqueue(chunk.slice(bytesToSkip));
		},
	});
}
