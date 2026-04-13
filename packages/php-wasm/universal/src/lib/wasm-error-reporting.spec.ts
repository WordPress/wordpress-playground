import { describe, it, expect } from 'vitest';
import { clarifyErrorMessage } from './wasm-error-reporting';

describe('clarifyErrorMessage', () => {
	it('classifies "unreachable" with Asyncify stack and PHP functions as an Asyncify issue', () => {
		const error = new Error('unreachable');
		error.stack =
			'Error: unreachable\n' +
			'    at wasm://wasm/php_execute_script (wasm://wasm/0x1234)\n' +
			'    at wasm://wasm/zend_execute (wasm://wasm/0x5678)';
		const asyncifyStack =
			'Error\n' +
			'    at wasm://wasm/php_execute_script (wasm://wasm/0x1234)';

		const result = clarifyErrorMessage(error, asyncifyStack);
		expect(result).toContain('ASYNCIFY_ONLY');
		expect(result).toContain('php_execute_script');
	});

	it('classifies "unreachable" without Asyncify stack as a WASM trap', () => {
		const error = new Error('unreachable');
		error.stack =
			'Error: unreachable\n' +
			'    at wasm://wasm/inflate (wasm://wasm/0x1234)\n' +
			'    at wasm://wasm/updatewindow (wasm://wasm/0x5678)';

		const result = clarifyErrorMessage(error, undefined);
		expect(result).toContain('WASM runtime error');
		expect(result).toContain('corrupt or malformed data');
		expect(result).not.toContain('ASYNCIFY_ONLY');
	});

	it('classifies "unreachable" with Asyncify stack but no PHP functions as a WASM trap', () => {
		const error = new Error('unreachable');
		// Stack with no wasm:/ entries (no PHP functions extracted)
		error.stack = 'Error: unreachable\n    at Object.run (index.js:1:1)';
		const asyncifyStack = 'Error\n    at Object.run (index.js:1:1)';

		const result = clarifyErrorMessage(error, asyncifyStack);
		expect(result).toContain('WASM runtime error');
		expect(result).not.toContain('ASYNCIFY_ONLY');
	});

	it('classifies "memory access out of bounds" as a WASM trap', () => {
		const error = new Error('memory access out of bounds');

		const result = clarifyErrorMessage(error, undefined);
		expect(result).toContain('WASM runtime error');
		expect(result).toContain('corrupt or malformed data');
		expect(result).toContain('memory access out of bounds');
	});

	it('returns original message for other errors', () => {
		const error = new Error('something else went wrong');

		const result = clarifyErrorMessage(error, undefined);
		expect(result).toBe('something else went wrong');
	});
});
