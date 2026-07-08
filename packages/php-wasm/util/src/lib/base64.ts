export function decodeBase64ToString(base64: string) {
	return new TextDecoder().decode(decodeBase64ToUint8Array(base64));
}

export function decodeBase64ToUint8Array(base64: string) {
	const binaryString = atob(base64);
	const len = binaryString.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
}

export function encodeStringAsBase64(str: string) {
	return encodeUint8ArrayAsBase64(new TextEncoder().encode(str));
}

export function encodeUint8ArrayAsBase64(bytes: Uint8Array) {
	/**
	 * String.fromCharCode can only take up to 65536 arguments,
	 * so we need to chunk the input into smaller pieces before converting it to a string.
	 * Reference: https://bugs.webkit.org/show_bug.cgi?id=80797
	 */
	const chunkSize = 65536;
	const chunks: string[] = [];
	for (let i = 0; i < bytes.length; i += chunkSize) {
		chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
	}
	return btoa(chunks.join(''));
}
