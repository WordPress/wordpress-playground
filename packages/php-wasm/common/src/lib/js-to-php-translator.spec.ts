import { jsToPHPTranslator } from './js-to-php-translator';

describe('PHP Translator', () => {
	let t: ReturnType<typeof jsToPHPTranslator>;

	beforeEach(() => {
		t = jsToPHPTranslator();
	});

	test('translate function calls', () => {
		const code = t.echo('Hello, World!');
		expect(code + '').toBe('echo("Hello, World!")');
	});

	test('translate function calls with multiple arguments', () => {
		const code = t.multiply(5, 3);
		expect(code + '').toBe('multiply(5, 3)');
	});

	test('translate variable access', () => {
		const code = t.$variable;
		expect(code + '').toBe('$variable');
	});

	test('translate variable assignment', () => {
		const code = t.assign(t.$variable, 42);
		expect(code + '').toBe('assign($variable, 42)');
	});

	test('translate arrays and objects', () => {
		const code = t.someFunction({ key: 'value' }, [1, 2, 3]);
		expect(code + '').toBe(
			'someFunction(array("key" => "value"), array(1, 2, 3))'
		);
	});

	test('translate nested arrays and objects', () => {
		const code = t.someFunction({ outer: { inner: 'value' } }, [
			1,
			['a', 'b'],
			3,
		]);
		expect(code + '').toBe(
			'someFunction(array("outer" => array("inner" => "value")), array(1, array("a", "b"), 3))'
		);
	});

	test('translate composed function calls', () => {
		const code = t.file_put_contents(t.get_path(), 'data');
		expect(code + '').toBe('file_put_contents(get_path(), "data")');
	});

	test('translate multiple composed function calls', () => {
		const code = t.operation(
			t.first_function(),
			t.second_function(t.$variable)
		);
		expect(code + '').toBe(
			'operation(first_function(), second_function($variable))'
		);
	});

	test('properly encode strings', () => {
		const code = t.echo('Hello, "World!"');
		expect(code + '').toBe('echo("Hello, \\"World!\\"")');
	});

	test('properly encode strings with special characters', () => {
		const code = t.echo('Hello,\nWorld!');
		expect(code + '').toBe('echo("Hello,\\nWorld!")');
	});

	test('properly encode strings with unicode characters', () => {
		const code = t.echo('こんにちは');
		expect(code + '').toBe('echo("こんにちは")');
	});
});
