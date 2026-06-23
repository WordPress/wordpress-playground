import {
	decodeBase64ToString,
	decodeBase64ToUint8Array,
	encodeStringAsBase64,
	encodeUint8ArrayAsBase64,
} from './base64';

describe('base64', () => {
	// RFC 4648 §10 vectors pin the exact wire format and padding so the
	// encoding stays interoperable with PHP's base64_decode(), which is how
	// these helpers are consumed across the JS/PHP boundary (see php-vars.ts).
	// https://datatracker.ietf.org/doc/html/rfc4648#section-10
	it.each([
		['', ''],
		['f', 'Zg=='],
		['fo', 'Zm8='],
		['foo', 'Zm9v'],
		['foob', 'Zm9vYg=='],
		['fooba', 'Zm9vYmE='],
		['foobar', 'Zm9vYmFy'],
	])('encodes %j as %j and decodes it back (RFC 4648)', (text, base64) => {
		expect(encodeStringAsBase64(text)).toBe(base64);
		expect(decodeBase64ToString(base64)).toBe(text);
	});

	it('round-trips UTF-8 beyond the Basic Multilingual Plane', () => {
		const text = 'Hello \u{1f680} café \u{2603} \u{10ffff}';

		expect(decodeBase64ToString(encodeStringAsBase64(text))).toBe(text);
	});

	it('encodes large inputs without overflowing the call stack', () => {
		// Create a 131072 byte array of 'A's (0x41)
		const bytes = new Uint8Array(0x20000).fill(0x41);

		expect(
			decodeBase64ToUint8Array(encodeUint8ArrayAsBase64(bytes))
		).toEqual(bytes);
	});
});
