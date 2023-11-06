import { phpVar } from './php-vars';

describe('phpVar', () => {
	test('translates strings', () => {
		const result = phpVar('Hello, World!');
		expect(result).toBe(
			`json_decode(base64_decode('IkhlbGxvLCBXb3JsZCEi'), true)`
		);
	});

	test('escapes single quotes in strings (simple)', () => {
		const result = phpVar(`This is Playground's test suite`);
		expect(result).toBe(
			`json_decode(base64_decode('IlRoaXMgaXMgUGxheWdyb3VuZCdzIHRlc3Qgc3VpdGUi'), true)`
		);
	});

	test('escapes single quotes in strings (complex)', () => {
		const result = phpVar(
			`This is an escaped quot: \\'. This is an escaped backslash and a quot: \\\\'. This is an evil terminating backslash: \\`
		);
		expect(result).toBe(
			`json_decode(base64_decode('IlRoaXMgaXMgYW4gZXNjYXBlZCBxdW90OiBcXCcuIFRoaXMgaXMgYW4gZXNjYXBlZCBiYWNrc2xhc2ggYW5kIGEgcXVvdDogXFxcXCcuIFRoaXMgaXMgYW4gZXZpbCB0ZXJtaW5hdGluZyBiYWNrc2xhc2g6IFxcIg=='), true)`
		);
	});

	test('translates numbers', () => {
		const result = phpVar(5);
		expect(result).toBe(`json_decode(base64_decode('NQ=='), true)`);
	});

	test('translates arrays', () => {
		const result = phpVar([5, 'test']);
		expect(result).toBe(
			`json_decode(base64_decode('WzUsInRlc3QiXQ=='), true)`
		);
	});

	test('translates objects', () => {
		const result = phpVar({ a: 5, b: 'test' });
		expect(result).toBe(
			`json_decode(base64_decode('eyJhIjo1LCJiIjoidGVzdCJ9'), true)`
		);
	});

	test('translate nested arrays', () => {
		const result = phpVar([1, ['a', 'b'], 3]);
		expect(result).toBe(
			`json_decode(base64_decode('WzEsWyJhIiwiYiJdLDNd'), true)`
		);
	});

	test('translate nested objects', () => {
		const result = phpVar({ outer: { inner: 'value' } });
		expect(result).toBe(
			`json_decode(base64_decode('eyJvdXRlciI6eyJpbm5lciI6InZhbHVlIn19'), true)`
		);
	});

	test('properly encodes strings', () => {
		const result = phpVar('Hello, "World!"');
		expect(result).toBe(
			`json_decode(base64_decode('IkhlbGxvLCBcIldvcmxkIVwiIg=='), true)`
		);
	});

	test('properly encodes strings with special characters', () => {
		const result = phpVar('Hello,\nWorld!');
		expect(result).toBe(
			`json_decode(base64_decode('IkhlbGxvLFxuV29ybGQhIg=='), true)`
		);
	});

	test('properly enchodes strings with uniresult characters', () => {
		const result = phpVar('こんにちは');
		expect(result).toBe(
			`json_decode(base64_decode('IuOBk+OCk+OBq+OBoeOBryI='), true)`
		);
	});
});
