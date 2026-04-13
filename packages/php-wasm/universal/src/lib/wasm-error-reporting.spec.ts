import { describe, it, expect } from 'vitest';
import { clarifyErrorMessage } from './wasm-error-reporting';

describe('clarifyErrorMessage', () => {
	it('includes PHP functions from the stack when present', () => {
		const error = new Error('unreachable');
		error.stack =
			'Error: unreachable\n' +
			'    at wasm://wasm/php_execute_script (wasm://wasm/0x1234)\n' +
			'    at wasm://wasm/zend_execute (wasm://wasm/0x5678)';
		const asyncifyStack =
			'Error\n' +
			'    at wasm://wasm/php_execute_script (wasm://wasm/0x1234)';

		const result = clarifyErrorMessage(error, asyncifyStack);
		expect(result).toContain('WASM runtime error');
		expect(result).toContain('php_execute_script');
		expect(result).toContain('ASYNCIFY_ONLY');
	});

	it('handles "unreachable" without Asyncify stack', () => {
		const error = new Error('unreachable');
		error.stack =
			'Error: unreachable\n' +
			'    at wasm://wasm/inflate (wasm://wasm/0x1234)\n' +
			'    at wasm://wasm/updatewindow (wasm://wasm/0x5678)';

		const result = clarifyErrorMessage(error, undefined);
		expect(result).toContain('WASM runtime error');
		expect(result).toContain('inflate');
		expect(result).toContain('unreachable');
	});

	it('handles "unreachable" with no WASM functions in trace', () => {
		const error = new Error('unreachable');
		error.stack = 'Error: unreachable\n    at Object.run (index.js:1:1)';

		const result = clarifyErrorMessage(error, undefined);
		expect(result).toContain('WASM runtime error');
		expect(result).not.toContain('PHP functions found');
	});

	it('handles "memory access out of bounds"', () => {
		const error = new Error('memory access out of bounds');

		const result = clarifyErrorMessage(error, undefined);
		expect(result).toContain('WASM runtime error');
		expect(result).toContain('memory access out of bounds');
	});

	it('mentions all three common causes', () => {
		const error = new Error('unreachable');
		error.stack = 'Error: unreachable\n    at Object.run (index.js:1:1)';

		const result = clarifyErrorMessage(error, undefined);
		expect(result).toContain('ASYNCIFY_ONLY');
		expect(result).toContain('Corrupt or malformed data');
		expect(result).toContain('WASM memory');
	});

	it('returns original message for other errors', () => {
		const error = new Error('something else went wrong');

		const result = clarifyErrorMessage(error, undefined);
		expect(result).toBe('something else went wrong');
	});
});
