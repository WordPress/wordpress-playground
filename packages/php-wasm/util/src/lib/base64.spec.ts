import {
	decodeBase64ToString,
	decodeBase64ToUint8Array,
	encodeStringAsBase64,
	encodeUint8ArrayAsBase64,
} from './base64';

describe('base64', () => {
	it('round-trips UTF-8 strings', () => {
		const text = 'Hello \u{1f680}';

		expect(decodeBase64ToString(encodeStringAsBase64(text))).toBe(text);
	});

	it('round-trips arbitrary bytes', () => {
		const bytes = new Uint8Array([0, 1, 127, 128, 255]);

		expect(
			Array.from(
				decodeBase64ToUint8Array(encodeUint8ArrayAsBase64(bytes))
			)
		).toEqual(Array.from(bytes));
	});

	it('encodes large byte arrays', () => {
		const bytes = Uint8Array.from(
			{ length: 100_000 },
			(_value, index) => index % 256
		);

		expect(
			Array.from(
				decodeBase64ToUint8Array(encodeUint8ArrayAsBase64(bytes))
			)
		).toEqual(Array.from(bytes));
	});
});
