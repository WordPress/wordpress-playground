export function decodeBase64ToString(base64: string) {
	return new TextDecoder().decode(decodeBase64ToUint8Array(base64));
}

export function decodeBase64ToUint8Array(base64: string) {
	const binaryString = window.atob(base64); // This will convert base64 to binary string
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
	const binString = String.fromCodePoint(...bytes);
	return btoa(binString);
}
