/**
 * Decode a base64 string to a UTF-8 string.
 * Works in both browser and Node.js environments.
 */
export function decodeBase64ToString(base64: string): string {
	return new TextDecoder().decode(decodeBase64ToUint8Array(base64));
}

/**
 * Decode a base64 string to a Uint8Array.
 * Works in both browser and Node.js environments.
 */
export function decodeBase64ToUint8Array(base64: string): Uint8Array {
	// Use globalThis to work in both browser and Node.js
	const atobFn =
		typeof atob !== 'undefined'
			? atob
			: (str: string) => Buffer.from(str, 'base64').toString('binary');

	const binaryString = atobFn(base64);
	const len = binaryString.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
}

/**
 * Encode a UTF-8 string to base64.
 * Works in both browser and Node.js environments.
 */
export function encodeStringAsBase64(str: string): string {
	return encodeUint8ArrayAsBase64(new TextEncoder().encode(str));
}

/**
 * Encode a Uint8Array to base64.
 * Works in both browser and Node.js environments.
 */
export function encodeUint8ArrayAsBase64(bytes: Uint8Array): string {
	const binString = String.fromCodePoint(...bytes);

	// Use globalThis to work in both browser and Node.js
	const btoaFn =
		typeof btoa !== 'undefined'
			? btoa
			: (str: string) => Buffer.from(str, 'binary').toString('base64');

	return btoaFn(binString);
}
