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
	// Build the binary string in chunks. Spreading the whole array into
	// String.fromCharCode overflows the call stack for large inputs
	// (GitHub file contents, TLS certificates, blueprint files).
	const CHUNK_SIZE = 0x8000;
	let binaryString = '';
	for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
		const chunk = bytes.subarray(offset, offset + CHUNK_SIZE);
		binaryString += String.fromCharCode(...chunk);
	}
	return btoa(binaryString);
}
