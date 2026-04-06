import { describe, it, expect } from 'vitest';
import {
	replaceNullCoalescing,
	replacePhp7ErrorClasses,
	stripPhp7TypeDeclarations,
} from '../legacy-php-compat';

describe('stripPhp7TypeDeclarations', () => {
	it('removes return type declarations', () => {
		expect(stripPhp7TypeDeclarations('function foo(): string {')).toBe(
			'function foo() {'
		);
	});

	it('removes return type on interface methods (ending with ;)', () => {
		const result = stripPhp7TypeDeclarations('function foo(): string;');
		expect(result.replace(/\s+;/, ';')).toBe('function foo();');
	});

	it('removes parameter type hints', () => {
		expect(
			stripPhp7TypeDeclarations('function foo(string $bar, int $baz) {')
		).toBe('function foo($bar, $baz) {');
	});

	it('removes mixed parameter type', () => {
		expect(stripPhp7TypeDeclarations('function foo(mixed $bar) {')).toBe(
			'function foo($bar) {'
		);
	});

	it('removes nullable types', () => {
		expect(
			stripPhp7TypeDeclarations('function foo(?string $bar): ?bool {')
		).toBe('function foo($bar) {');
	});

	it('removes never return type', () => {
		expect(stripPhp7TypeDeclarations('function foo(): never {')).toBe(
			'function foo() {'
		);
	});

	it('leaves code without type hints unchanged', () => {
		const code = 'function foo($bar) { return $bar; }';
		expect(stripPhp7TypeDeclarations(code)).toBe(code);
	});
});

describe('replaceNullCoalescing', () => {
	it('replaces simple variable ?? default', () => {
		expect(replaceNullCoalescing("$x ?? 'y'")).toBe("isset($x) ? $x : 'y'");
	});

	it('replaces array access ?? default', () => {
		expect(replaceNullCoalescing('$arr[$i] ?? null')).toBe(
			'isset($arr[$i]) ? $arr[$i] : null'
		);
	});

	it('replaces property chain ?? default', () => {
		expect(replaceNullCoalescing("$this->prop ?? ''")).toBe(
			"isset($this->prop) ? $this->prop : ''"
		);
	});

	it('replaces self::CONST[$key] ?? default with array_key_exists', () => {
		expect(
			replaceNullCoalescing(
				'$type = self::TOKENS[ $value ] ?? self::IDENTIFIER;'
			)
		).toBe(
			'$type = (array_key_exists($value, self::TOKENS) ? self::TOKENS[$value] : self::IDENTIFIER);'
		);
	});

	it('replaces static::CONST[$key] ?? default', () => {
		expect(replaceNullCoalescing('static::MAP[ $key ] ?? null')).toBe(
			'(array_key_exists($key, static::MAP) ? static::MAP[$key] : null)'
		);
	});

	it('replaces method calls with args using temp variable', () => {
		expect(replaceNullCoalescing("$this->get('key') ?? $fallback")).toBe(
			"(($__playground_nc_tmp = $this->get('key')) !== null ? $__playground_nc_tmp : $fallback)"
		);
	});

	it('returns content without ?? instantly (fast path)', () => {
		const longCode = 'x'.repeat(100000);
		const start = Date.now();
		const result = replaceNullCoalescing(longCode);
		expect(Date.now() - start).toBeLessThan(10);
		expect(result).toBe(longCode);
	});

	it('preserves nullsafe operator (?->) in code with ??', () => {
		const code = "$obj?->method() ?? 'default'";
		const result = replaceNullCoalescing(code);
		expect(result).toContain('?->');
		expect(result).not.toContain('??');
	});

	it('handles function call as fallback value', () => {
		expect(replaceNullCoalescing('$x ?? get_default()')).toBe(
			'isset($x) ? $x : get_default()'
		);
	});

	it('handles nested ?? (chained null coalescing)', () => {
		const result = replaceNullCoalescing("$a ?? $b ?? 'c'");
		// Should process from left to right, producing nested ternaries
		expect(result).not.toContain('??');
	});
});

describe('replacePhp7ErrorClasses', () => {
	it('replaces catch (Throwable) with catch (Exception)', () => {
		expect(replacePhp7ErrorClasses('catch ( Throwable $e )')).toBe(
			'catch ( Exception $e )'
		);
	});

	it('replaces catch (\\Throwable) with catch (Exception)', () => {
		expect(replacePhp7ErrorClasses('catch ( \\Throwable $e )')).toBe(
			'catch ( Exception $e )'
		);
	});

	it('replaces new TypeError with new Exception', () => {
		expect(replacePhp7ErrorClasses("throw new TypeError('bad')")).toBe(
			"throw new Exception('bad')"
		);
	});

	it('replaces new ArgumentCountError with new Exception', () => {
		expect(
			replacePhp7ErrorClasses("throw new ArgumentCountError('msg')")
		).toBe("throw new Exception('msg')");
	});

	it('removes PHP 8 attributes', () => {
		const code = '#[ReturnTypeWillChange]\n\tpublic function foo()';
		const result = replacePhp7ErrorClasses(code);
		expect(result).not.toContain('#[ReturnTypeWillChange]');
		expect(result).toContain('public function foo()');
	});

	it('removes declare(strict_types=1)', () => {
		expect(replacePhp7ErrorClasses('declare(strict_types=1);')).toBe('');
	});

	it('replaces Closure::call with bindTo equivalent', () => {
		expect(replacePhp7ErrorClasses('$fn->call($obj, $arg)')).toBe(
			'call_user_func($fn->bindTo($obj, get_class($obj)), $arg)'
		);
	});

	it('replaces extends Error with extends Exception', () => {
		expect(replacePhp7ErrorClasses('class Foo extends Error {')).toBe(
			'class Foo extends Exception {'
		);
	});

	it('replaces callable property invocation with call_user_func', () => {
		expect(replacePhp7ErrorClasses('( $this->callback )( $arg )')).toBe(
			'call_user_func($this->callback, $arg )'
		);
	});

	it('replaces isset(self::CONST[$key]) with array_key_exists', () => {
		expect(replacePhp7ErrorClasses('isset(self::MAP[$key])')).toBe(
			'array_key_exists($key, self::MAP)'
		);
	});

	it('leaves non-matching code unchanged', () => {
		const code = 'function foo($bar) { return $bar; }';
		expect(replacePhp7ErrorClasses(code)).toBe(code);
	});
});
