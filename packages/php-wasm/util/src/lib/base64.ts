export function decodeBase64ToString(base64: string): string {
	return new TextDecoder().decode(decodeBase64ToUint8Array(base64));
}

export function decodeBase64ToUint8Array(base64: string): Uint8Array {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let index = 0; index < binaryString.length; index++) {
		bytes[index] = binaryString.charCodeAt(index);
	}
	return bytes;
}

export function encodeStringAsBase64(text: string): string {
	return encodeUint8ArrayAsBase64(new TextEncoder().encode(text));
}

export function encodeUint8ArrayAsBase64(bytes: Uint8Array): string {
	// Build the binary string one byte at a time. Spreading the array into
	// String.fromCharCode(...bytes) overflows the argument limit for large
	// inputs and throws a RangeError.
	let binaryString = '';
	for (let index = 0; index < bytes.length; index++) {
		binaryString += String.fromCharCode(bytes[index]);
	}
	return btoa(binaryString);
}
