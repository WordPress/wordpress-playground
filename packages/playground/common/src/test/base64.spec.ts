import { describe, it, expect } from 'vitest';
import { decodeBase64ToString, encodeStringAsBase64 } from '../base64';

describe('base64 utilities', () => {
	it('should decode base64 string to text', () => {
		const encoded = 'SGVsbG8gV29ybGQ='; // "Hello World"
		const result = decodeBase64ToString(encoded);
		expect(result).toBe('Hello World');
	});

	it('should decode base64 JSON blueprint', () => {
		const blueprint = { landingPage: '/?p=4' };
		const encoded = encodeStringAsBase64(JSON.stringify(blueprint));
		const decoded = decodeBase64ToString(encoded);
		expect(JSON.parse(decoded)).toEqual(blueprint);
	});

	it('should handle special characters', () => {
		const text = 'Special: €ñ中文';
		const encoded = encodeStringAsBase64(text);
		const decoded = decodeBase64ToString(encoded);
		expect(decoded).toBe(text);
	});
});
