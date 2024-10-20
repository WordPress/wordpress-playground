function hexStringToArrayBuffer(hex: string): ArrayBuffer {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
	}
	return bytes.buffer;
}

async function hmacSha256(
	key: CryptoKey,
	data: ArrayBuffer
): Promise<ArrayBuffer> {
	return await crypto.subtle.sign(
		{ name: 'HMAC', hash: 'SHA-256' },
		key,
		data
	);
}

function concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
	const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
	const temp = new Uint8Array(totalLength);
	let offset = 0;
	for (const buf of buffers) {
		temp.set(new Uint8Array(buf), offset);
		offset += buf.byteLength;
	}
	return temp.buffer;
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
		''
	);
}

export function stringToArrayBuffer(str: string): ArrayBuffer {
	const encoder = new TextEncoder();
	return encoder.encode(str).buffer;
}

// PRF implementation
export async function tls12Prf(
	secret: ArrayBuffer,
	label: ArrayBuffer,
	seed: ArrayBuffer,
	outputLength: number
): Promise<ArrayBuffer> {
	const seedBytes = concatArrayBuffers([label, seed]);

	// Import the secret as a CryptoKey
	const hmacKey = await crypto.subtle.importKey(
		'raw',
		secret,
		{ name: 'HMAC', hash: { name: 'SHA-256' } },
		false,
		['sign']
	);

	let A = seedBytes; // Initialize A(0) = seedBytes
	const resultBuffers: ArrayBuffer[] = [];
	let iteration = 1;

	while (concatArrayBuffers(resultBuffers).byteLength < outputLength) {
		// A(i) = HMAC_hash(secret, A(i-1))
		A = await hmacSha256(hmacKey, A);
		console.log(`A(${iteration}): ${arrayBufferToHex(A)}`);

		// Compute HMAC_hash(secret, A(i) + seedBytes)
		const hmacInput = concatArrayBuffers([A, seedBytes]);
		const fragment = await hmacSha256(hmacKey, hmacInput);
		console.log(`Fragment ${iteration}: ${arrayBufferToHex(fragment)}`);

		resultBuffers.push(fragment);
		iteration++;
	}

	// Concatenate and trim the result to the desired length
	const fullResult = concatArrayBuffers(resultBuffers);
	return fullResult.slice(0, outputLength);
}

async function testHmacSha256() {
	const keyHex = '0b'.repeat(20);
	const dataHex = '4869205468657265'; // "Hi There"

	const key = hexStringToArrayBuffer(keyHex);
	const data = hexStringToArrayBuffer(dataHex);

	// Import the key
	const hmacKey = await crypto.subtle.importKey(
		'raw',
		key,
		{ name: 'HMAC', hash: { name: 'SHA-256' } },
		false,
		['sign']
	);

	// Compute HMAC
	const hmacResult = await hmacSha256(hmacKey, data);
	const hmacHex = arrayBufferToHex(hmacResult);
	console.log(`Computed HMAC: ${hmacHex}`);

	// Expected HMAC
	const expectedHmac =
		'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7';

	if (hmacHex.toLowerCase() === expectedHmac.toLowerCase()) {
		console.log('HMAC implementation is correct.');
	} else {
		console.error('HMAC implementation is incorrect.');
	}
}

// testHmacSha256();

// Helper function to compare two ArrayBuffers for equality using crypto.subtle.digest
async function buffersEqual(
	buf1: ArrayBuffer,
	buf2: ArrayBuffer
): Promise<boolean> {
	if (buf1.byteLength !== buf2.byteLength) return false;

	// Use subtle.digest to compute hashes and compare them
	const hash1 = await crypto.subtle.digest('SHA-256', buf1);
	const hash2 = await crypto.subtle.digest('SHA-256', buf2);

	const view1 = new Uint8Array(hash1);
	const view2 = new Uint8Array(hash2);

	for (let i = 0; i < view1.length; i++) {
		if (view1[i] !== view2[i]) return false;
	}
	return true;
}

// (async () => {
// 	const secret = new Uint8Array([
// 		0x9b, 0xbe, 0x43, 0x6b, 0xa9, 0x40, 0xf0, 0x17, 0xb1, 0x76, 0x52, 0x84,
// 		0x9a, 0x71, 0xdb, 0x35,
// 	]);
// 	const label = new Uint8Array([
// 		0x74, 0x65, 0x73, 0x74, 0x20, 0x6c, 0x61, 0x62, 0x65, 0x6c,
// 	]);
// 	const seed = new Uint8Array([
// 		0xa0, 0xba, 0x9f, 0x93, 0x6c, 0xda, 0x31, 0x18, 0x27, 0xa6, 0xf7, 0x96,
// 		0xff, 0xd5, 0x19, 0x8c,
// 	]);
// 	const expectedOutput = new Uint8Array([
// 		0xe3, 0xf2, 0x29, 0xba, 0x72, 0x7b, 0xe1, 0x7b, 0x8d, 0x12, 0x26, 0x20,
// 		0x55, 0x7c, 0xd4, 0x53, 0xc2, 0xaa, 0xb2, 0x1d, 0x07, 0xc3, 0xd4, 0x95,
// 		0x32, 0x9b, 0x52, 0xd4, 0xe6, 0x1e, 0xdb, 0x5a, 0x6b, 0x30, 0x17, 0x91,
// 		0xe9, 0x0d, 0x35, 0xc9, 0xc9, 0xa4, 0x6b, 0x4e, 0x14, 0xba, 0xf9, 0xaf,
// 		0x0f, 0xa0, 0x22, 0xf7, 0x07, 0x7d, 0xef, 0x17, 0xab, 0xfd, 0x37, 0x97,
// 		0xc0, 0x56, 0x4b, 0xab, 0x4f, 0xbc, 0x91, 0x66, 0x6e, 0x9d, 0xef, 0x9b,
// 		0x97, 0xfc, 0xe3, 0x4f, 0x79, 0x67, 0x89, 0xba, 0xa4, 0x80, 0x82, 0xd1,
// 		0x22, 0xee, 0x42, 0xc5, 0xa7, 0x2e, 0x5a, 0x51, 0x10, 0xff, 0xf7, 0x01,
// 		0x87, 0x34, 0x7b, 0x66,
// 	]);

// 	const prfOutput = await tls12Prf(
// 		secret,
// 		label,
// 		seed,
// 		expectedOutput.byteLength
// 	);
// 	const prfOutputHex = arrayBufferToHex(prfOutput);
// 	console.log(
// 		`PRF Output (${expectedOutput.byteLength} bytes): ${prfOutputHex}`
// 	);

// 	if (await buffersEqual(prfOutput, expectedOutput)) {
// 		console.log('PRF implementation is correct.');
// 	} else {
// 		console.error('PRF implementation is incorrect.');
// 	}
// })();
