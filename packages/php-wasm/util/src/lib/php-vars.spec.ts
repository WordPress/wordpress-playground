import { phpVar } from './php-vars';

describe('phpVar', () => {
	test('translates strings', () => {
		const result = phpVar('Hello, World!');
		expect(result).toBe(`json_decode('"Hello, World!"')`);
	});

	test('escapes single quotes in strings (simple)', () => {
		const result = phpVar(`This is Playground's test suite`);
		expect(result).toBe(
			`json_decode('"This is Playground\\'s test suite"')`
		);
	});

	test('escapes single quotes in strings (complex)', () => {
		const result = phpVar(
			`This is an escaped quot: \\'. This is an escaped backslash and a quot: \\\\'. This is an evil terminating backslash: \\`
		);
		expect(result).toBe(
			`json_decode('"This is an escaped quot: \\\\\\\\\\'. This is an escaped backslash and a quot: \\\\\\\\\\\\\\\\\\'. This is an evil terminating backslash: \\\\\\\\"')`
		);
	});

	test('translates numbers', () => {
		const result = phpVar(5);
		expect(result).toBe('5');
	});

	test('translates arrays', () => {
		const result = phpVar([5, 'test']);
		expect(result).toBe(`array(5, json_decode('"test"'))`);
	});

	test('translates objects', () => {
		const result = phpVar({ a: 5, b: 'test' });
		expect(result).toBe(
			`array(json_decode('"a"') => 5, json_decode('"b"') => json_decode('"test"'))`
		);
	});

	test('translate nested arrays', () => {
		const result = phpVar([1, ['a', 'b'], 3]);
		expect(result).toBe(
			`array(1, array(json_decode('"a"'), json_decode('"b"')), 3)`
		);
	});

	test('translate nested objects', () => {
		const result = phpVar({ outer: { inner: 'value' } });
		expect(result).toBe(
			`array(json_decode('"outer"') => array(json_decode('"inner"') => json_decode('"value"')))`
		);
	});

	test('properly encodes strings', () => {
		const result = phpVar('Hello, "World!"');
		expect(result).toBe(`json_decode('"Hello, \\\\"World!\\\\""')`);
	});

	test('properly encodes strings with special characters', () => {
		const result = phpVar('Hello,\nWorld!');
		expect(result).toBe(`json_decode('"Hello,\\\\nWorld!"')`);
	});

	test('properly enchodes strings with uniresult characters', () => {
		const result = phpVar('こんにちは');
		expect(result).toBe(`json_decode('"こんにちは"')`);
	});
});
