import { phpVar } from './php-vars';

describe('phpVar', () => {
	test('translates strings', () => {
		const result = phpVar('Hello, World!');
		expect(result).toBe(`base64_decode('SGVsbG8sIFdvcmxkIQ==')`);
	});

	test('escapes single quotes in strings (simple)', () => {
		const result = phpVar(`This is Playground's test suite`);
		expect(result).toBe(
			`base64_decode('VGhpcyBpcyBQbGF5Z3JvdW5kJ3MgdGVzdCBzdWl0ZQ==')`
		);
	});

	test('escapes single quotes in strings (complex)', () => {
		const result = phpVar(
			`This is an escaped quot: \\'. This is an escaped backslash and a quot: \\\\'. This is an evil terminating backslash: \\`
		);
		expect(result).toBe(
			`base64_decode('VGhpcyBpcyBhbiBlc2NhcGVkIHF1b3Q6IFwnLiBUaGlzIGlzIGFuIGVzY2FwZWQgYmFja3NsYXNoIGFuZCBhIHF1b3Q6IFxcJy4gVGhpcyBpcyBhbiBldmlsIHRlcm1pbmF0aW5nIGJhY2tzbGFzaDogXA==')`
		);
	});

	test('translates numbers', () => {
		const result = phpVar(5);
		expect(result).toBe('5');
	});

	test('translates arrays', () => {
		const result = phpVar([5, 'test']);
		expect(result).toBe(`array(5, base64_decode('dGVzdA=='))`);
	});

	test('translates objects', () => {
		const result = phpVar({ a: 5, b: 'test' });
		expect(result).toBe(
			`array(base64_decode('YQ==') => 5, base64_decode('Yg==') => base64_decode('dGVzdA=='))`
		);
	});

	test('translate nested arrays', () => {
		const result = phpVar([1, ['a', 'b'], 3]);
		expect(result).toBe(
			`array(1, array(base64_decode('YQ=='), base64_decode('Yg==')), 3)`
		);
	});

	test('translate nested objects', () => {
		const result = phpVar({ outer: { inner: 'value' } });
		expect(result).toBe(
			`array(base64_decode('b3V0ZXI=') => array(base64_decode('aW5uZXI=') => base64_decode('dmFsdWU=')))`
		);
	});

	test('properly encodes strings', () => {
		const result = phpVar('Hello, "World!"');
		expect(result).toBe(`base64_decode('SGVsbG8sICJXb3JsZCEi')`);
	});

	test('properly encodes strings with special characters', () => {
		const result = phpVar('Hello,\nWorld!');
		expect(result).toBe(`base64_decode('SGVsbG8sCldvcmxkIQ==')`);
	});

	test('properly enchodes strings with uniresult characters', () => {
		const result = phpVar('こんにちは');
		expect(result).toBe(`base64_decode('44GT44KT44Gr44Gh44Gv')`);
	});
});
