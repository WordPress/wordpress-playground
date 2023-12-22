/**
 * Skips the first `length` bytes of a stream.
 *
 * @param length The number of bytes to skip.
 * @returns A transform stream that will skip the specified number of bytes.
 */
export function skipLastBytes(skip: number, streamLength: number) {
	let currentOffset = 0;
	const lastOffset = streamLength - skip;
	return new TransformStream({
		async transform(chunk, controller) {
			if (currentOffset + chunk.byteLength >= lastOffset) {
				const lastChunkOffset = lastOffset - currentOffset;
				if (lastChunkOffset === 0) {
					return;
				}
				chunk = chunk.slice(0, lastChunkOffset);
			}

			currentOffset += chunk.byteLength;
			controller.enqueue(chunk);
		},
	});
}
