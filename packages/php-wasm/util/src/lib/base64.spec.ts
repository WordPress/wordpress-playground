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

	it('decodes base64 with whitespace', () => {
		expect(decodeBase64ToString('SGVs\n bG8g\r\n8J+agA==')).toBe(
			'Hello \u{1f680}'
		);
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

	it('falls back to Buffer when atob and btoa are unavailable', () => {
		const originalAtob = globalThis.atob;
		const originalBtoa = globalThis.btoa;

		try {
			Object.defineProperty(globalThis, 'atob', {
				configurable: true,
				writable: true,
				value: undefined,
			});
			Object.defineProperty(globalThis, 'btoa', {
				configurable: true,
				writable: true,
				value: undefined,
			});

			expect(decodeBase64ToString('SGVsbG8g8J+agA==')).toBe(
				'Hello \u{1f680}'
			);
			expect(encodeStringAsBase64('Hello \u{1f680}')).toBe(
				'SGVsbG8g8J+agA=='
			);
		} finally {
			Object.defineProperty(globalThis, 'atob', {
				configurable: true,
				writable: true,
				value: originalAtob,
			});
			Object.defineProperty(globalThis, 'btoa', {
				configurable: true,
				writable: true,
				value: originalBtoa,
			});
		}
	});
});
