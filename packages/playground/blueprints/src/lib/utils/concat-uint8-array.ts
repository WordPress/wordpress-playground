/**
 * Concatenates multiple Uint8Arrays into a single Uint8Array.
 *
 * @param arrays The arrays to concatenate.
 * @returns A new Uint8Array containing the contents of all the arrays.
 */
export function concatUint8Array(...arrays: Uint8Array[]) {
	const result = new Uint8Array(
		arrays.reduce((sum, array) => sum + array.length, 0)
	);
	let offset = 0;
	for (const array of arrays) {
		result.set(array, offset);
		offset += array.length;
	}
	return result;
}
