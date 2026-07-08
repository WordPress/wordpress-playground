/**
 * Concatenates multiple byte arrays into a single `Uint8Array`.
 */
export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
	let totalLength = 0;
	arrays.forEach((a) => (totalLength += a.length));
	const result = new Uint8Array(totalLength);
	let offset = 0;
	arrays.forEach((a) => {
		result.set(a, offset);
		offset += a.length;
	});
	return result;
}

/**
 * Concatenates multiple array buffers into a single `ArrayBuffer`.
 */
export function concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
	return concatUint8Arrays(buffers.map((b) => new Uint8Array(b)))
		.buffer as ArrayBuffer;
}
