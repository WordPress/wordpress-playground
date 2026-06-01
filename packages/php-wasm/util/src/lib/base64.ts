type BufferLike = Uint8Array & {
	toString(encoding: 'base64'): string;
};

type BufferConstructorLike = {
	from(input: string, encoding: 'base64'): BufferLike;
	from(input: Uint8Array): BufferLike;
};

export function decodeBase64ToString(base64: string): string {
	return new TextDecoder().decode(decodeBase64ToUint8Array(base64));
}

export function decodeBase64ToUint8Array(base64: string): Uint8Array {
	const normalizedBase64 = base64.replace(/\s+/g, '');
	if (typeof globalThis.atob !== 'function') {
		const BufferConstructor = getBufferConstructor();
		if (!BufferConstructor) {
			throw new Error(
				'Base64 decoding is not available in this JavaScript runtime.'
			);
		}
		return new Uint8Array(
			BufferConstructor.from(normalizedBase64, 'base64')
		);
	}

	const binaryString = globalThis.atob(normalizedBase64);
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
	if (typeof globalThis.btoa !== 'function') {
		const BufferConstructor = getBufferConstructor();
		if (!BufferConstructor) {
			throw new Error(
				'Base64 encoding is not available in this JavaScript runtime.'
			);
		}
		return BufferConstructor.from(bytes).toString('base64');
	}

	const binaryStringChunks: string[] = [];
	const chunkSize = 0x8000;
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		binaryStringChunks.push(
			String.fromCodePoint(...bytes.subarray(offset, offset + chunkSize))
		);
	}
	return globalThis.btoa(binaryStringChunks.join(''));
}

function getBufferConstructor(): BufferConstructorLike | undefined {
	return (
		globalThis as typeof globalThis & {
			Buffer?: BufferConstructorLike;
		}
	).Buffer;
}
