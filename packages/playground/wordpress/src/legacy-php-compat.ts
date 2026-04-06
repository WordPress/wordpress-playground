/**
 * Strips PHP 7.0+ type declarations from PHP source code to make it
 * compatible with PHP 5.6.
 *
 * Handles:
 * - Parameter type hints: `function foo(string $bar)` → `function foo($bar)`
 * - Return type declarations: `): bool {` → `) {`
 * - Nullable types: `?string $bar` → `$bar`
 */
export function stripPhp7TypeDeclarations(phpCode: string): string {
	// Remove return type declarations — both primitive types and class names.
	// Matches `: Type {` or `: ?Type {` or `: Type ;` after closing paren.
	// The terminator can be `{` (method body) or `;` (interface/abstract).
	// NOTE: `null`, `true`, `false` are NOT included here because they
	// appear in ternary expressions (`: null;`) which would be falsely
	// matched. They're handled in the parameter type regex instead.
	let result = phpCode.replace(
		/\)\s*:\s*\??\s*(?:[A-Z\\][\w\\]*|self|static|bool|string|int|float|array|void|mixed|callable|iterable|object|never)\s*([{;])/g,
		') $1'
	);

	// Remove parameter type hints (built-in types)
	result = result.replace(
		/([,(]\s*)\??\s*(?:bool|string|int|float|array|callable|iterable|object|self|static|mixed|never|null|true|false|void)\s+(\$)/g,
		'$1$2'
	);

	// Remove nullable class type hints in parameters (?ClassName $var).
	// The ? nullable syntax is PHP 7.1+. We only strip nullable ones
	// since non-nullable class type hints are valid in PHP 5.6.
	result = result.replace(/([,(]\s*)\?\s*[A-Z\\][\w\\]*\s+(\$)/g, '$1$2');

	return result;
}

/**
 * Replaces PHP 7.0+ constructs that aren't type declarations or null
 * coalescing with PHP 5.6 compatible equivalents.
 *
 * Handles:
 * - `catch (Throwable $e)` → `catch (Exception $e)`
 * - `new TypeError(...)` → `new Exception(...)`
 * - `new ArgumentCountError(...)` → `new Exception(...)`
 * - `#[Attribute]` → removed (PHP 8.0 attributes)
 */
export function replacePhp7ErrorClasses(content: string): string {
	let result = content;

	// Remove PHP 8 attributes (entire line)
	result = result.replace(/^\s*#\[[\w\\]+\]\s*$/gm, '');

	// Remove declare(strict_types = 1) — PHP 7.0+ feature
	result = result.replace(
		/declare\s*\(\s*strict_types\s*=\s*1\s*\)\s*;?/g,
		''
	);

	// Replace PHP 7 callable property invocation with call_user_func:
	// ( $this->callback )( $args ) → call_user_func( $this->callback, $args )
	result = result.replace(
		/\(\s*(\$\w+(?:->\w+)+)\s*\)\(\s*([^)]*)\s*\)/g,
		(_, callable, args) => `call_user_func(${callable}, ${args})`
	);

	// Replace isset(self::CONST[$key]) with array_key_exists($key, self::CONST).
	// PHP 5.6 doesn't support isset() on class constant array access —
	// class constants are expressions, not variables.
	result = result.replace(
		/isset\(\s*((?:self|static)::\w+)\[\s*([^\]]+?)\s*\]\s*\)/g,
		(_, constRef, key) => `array_key_exists(${key.trim()}, ${constRef})`
	);

	// Replace Throwable with Exception in catch blocks and type hints
	result = result.replace(
		/catch\s*\(\s*\\?Throwable\b/g,
		'catch ( Exception'
	);
	// Replace Throwable parameter type hints with Exception
	result = result.replace(/([,(]\s*)\\?Throwable\s+(\$)/g, '$1Exception $2');

	// Replace PHP 7 error classes with Exception
	result = result.replace(
		/new\s+\\?(?:TypeError|ArgumentCountError|ValueError|Error)\s*\(/g,
		'new Exception('
	);

	// Replace class hierarchy: `extends Error` → `extends Exception`
	result = result.replace(
		/extends\s+\\?(?:Error|TypeError|ValueError)\b/g,
		'extends Exception'
	);

	// Replace Closure::call() with bindTo() equivalent (PHP 7.0+)
	result = result.replace(
		/(\$\w+)->call\(\s*(\$[\w>-]+)\s*,\s*(\$\w+)\s*\)/g,
		'call_user_func($1->bindTo($2, get_class($2)), $3)'
	);
	// Closure::call() without arguments
	result = result.replace(
		/(\$\w+)->call\(\s*(\$[\w>-]+)\s*\)/g,
		'call_user_func($1->bindTo($2, get_class($2)))'
	);

	return result;
}

/** Safety limit for the iterative ?? replacement loop. */
const MAX_NULL_COALESCING_ITERATIONS = 500;

/**
 * Replaces PHP 7.0+ null coalescing operators (`??`) with PHP 5.6
 * compatible equivalents.
 *
 * Handles:
 * - `$var ?? $default` → `isset($var) ? $var : $default`
 * - `$var->prop[$k] ?? $d` → `isset($var->prop[$k]) ? ... : $d`
 * - `self::CONST[$k] ?? $d` → `array_key_exists($k, self::CONST) ? ... : $d`
 *   (PHP 5.6 doesn't support `isset()` on class constant array access)
 * - `$obj->method() ?? $d` → uses temp variable to avoid double evaluation
 */
export function replaceNullCoalescing(content: string): string {
	// CRITICAL: Fast path to avoid catastrophic regex backtracking.
	if (!content.includes('??')) {
		return content;
	}

	// Protect nullsafe operators (?->) from being corrupted by ?? processing.
	// Replace `?->X` with `->__NS__X` so the `?` doesn't interfere with
	// `??` regex patterns while preserving the `->property` chain shape
	// that the general-case regex expects.
	const NULLSAFE_PREFIX = '__NS__';
	let result = content.replace(/\?->(\w)/g, `->${NULLSAFE_PREFIX}$1`);

	// Fallback value pattern shared by all cases.
	const fallbackPat =
		"(?:'[^']*'|\"[^\"]*\"|\\$[\\w]+(?:(?:\\['[^']*'\\])|(?:->[\\w]+))*|(?:self|static)::[\\w]+|\\w+\\([^)]*\\)|null|true|false|\\d+|[A-Z_]+|array\\(\\))";

	// 1. Class constant array access: self::CONST[$key] ?? fallback
	//    PHP 5.6 doesn't support isset() on class constant subscripts,
	//    so use array_key_exists() instead.
	//    The key pattern allows one level of nested brackets to handle
	//    expressions like `self::MAP[ $info['TYPE'] ]`.
	result = result.replace(
		new RegExp(
			'((?:self|static)::\\w+)\\[\\s*([^\\]]*(?:\\[[^\\]]*\\][^\\]]*)*)\\s*\\]\\s*\\?\\?\\s*(' +
				fallbackPat +
				')',
			'g'
		),
		(_, constRef, key, fallback) => {
			const k = key.trim();
			return `(array_key_exists(${k}, ${constRef}) ? ${constRef}[${k}] : ${fallback})`;
		}
	);

	// 1b. Multi-line method chain continuation: ->method(...) ?? fallback
	//     Handles cases where $var is on a previous line and only
	//     ->method(...) ?? fallback appears on the current line.
	//     The negative lookbehind ensures we don't match ->method()
	//     that's part of a $var->method() chain (handled by #3).
	//     Excludes word chars, ], and ) preceding the `->`.
	result = result.replace(
		new RegExp(
			'(?<![\\w\\]\\)])(->[\\w]+\\([^)]*\\))\\s*\\?\\?\\s*(' +
				fallbackPat +
				')',
			'g'
		),
		(_, call, fallback) => {
			return `(($__playground_nc_tmp = ${call}) !== null ? $__playground_nc_tmp : ${fallback})`;
		}
	);

	// 2. Function/method call result with array access:
	//    explode(...)[1] ?? $fallback
	result = result.replace(
		new RegExp(
			'(\\w+)\\(\\s*([^)]+)\\s*\\)\\[(\\d+)]\\s*\\?\\?\\s*(' +
				fallbackPat +
				')',
			'g'
		),
		(_, fn, args, idx, fallback) => {
			return `(($__playground_nc_tmp = ${fn}(${args})) && isset($__playground_nc_tmp[${idx}]) ? $__playground_nc_tmp[${idx}] : ${fallback})`;
		}
	);

	// 3. General case: variable/property/array/method access ?? default
	//
	// The bracket content uses `[^\]]*` (no nested bracket support)
	// to avoid catastrophic backtracking. Nested brackets like
	// `$a[$b[$c]]` are not needed in the SQLite integration code.
	let changed = true;
	let iterations = 0;
	while (changed) {
		if (++iterations > MAX_NULL_COALESCING_ITERATIONS) {
			break;
		}
		changed = false;
		const re = new RegExp(
			'(\\$[\\w]+(?:(?:\\[[^\\]]*\\])|(?:->[\\w]+(?:\\([^)]*\\))?))*' +
				')\\s*\\?\\?\\s*(' +
				fallbackPat +
				')',
			'g'
		);
		const replaced = result.replace(re, (_, lhs, rhs) => {
			changed = true;
			// If the LHS contains a method/function call, use a temp
			// variable to avoid calling it twice. The ?? operator
			// evaluates its LHS once; isset(x) ? x : y evaluates
			// x twice, which breaks side-effectful calls.
			if (lhs.includes('(')) {
				return `(($__playground_nc_tmp = ${lhs}) !== null ? $__playground_nc_tmp : ${rhs})`;
			}
			return `isset(${lhs}) ? ${lhs} : ${rhs}`;
		});
		result = replaced;
	}
	result = result.replace(new RegExp(`->${NULLSAFE_PREFIX}`, 'g'), '?->');
	return result;
}
