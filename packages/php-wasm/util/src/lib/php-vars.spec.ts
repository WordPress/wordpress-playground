import { phpVar } from './php-vars';

describe('phpVar', () => {
	test('translates strings', () => {
		const result = phpVar('Hello, World!');
		expect(result).toBe('"Hello, World!"');
	});

	test('translates numbers', () => {
		const result = phpVar(5);
		expect(result).toBe('5');
	});

	test('translates arrays', () => {
		const result = phpVar([5, 'test']);
		expect(result).toBe(`array(5, "test")`);
	});

	test('translates objects', () => {
		const result = phpVar({ a: 5, b: 'test' });
		expect(result).toBe(`array("a" => 5, "b" => "test")`);
	});

	test('translate nested arrays', () => {
		const result = phpVar([1, ['a', 'b'], 3]);
		expect(result).toBe('array(1, array("a", "b"), 3)');
	});

	test('translate nested objects', () => {
		const result = phpVar({ outer: { inner: 'value' } });
		expect(result).toBe('array("outer" => array("inner" => "value"))');
	});

	test('properly encodes strings', () => {
		const result = phpVar('Hello, "World!"');
		expect(result).toBe('"Hello, \\"World!\\""');
	});

	test('properly encodes strings with special characters', () => {
		const result = phpVar('Hello,\nWorld!');
		expect(result).toBe('"Hello,\\nWorld!"');
	});

	test('properly enchodes strings with uniresult characters', () => {
		const result = phpVar('こんにちは');
		expect(result).toBe('"こんにちは"');
	});
});
