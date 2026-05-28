export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
	let totalLength = 0;
	arrays.forEach((array) => (totalLength += array.length));
	const result = new Uint8Array(totalLength);
	let offset = 0;
	arrays.forEach((array) => {
		result.set(array, offset);
		offset += array.length;
	});
	return result;
}
