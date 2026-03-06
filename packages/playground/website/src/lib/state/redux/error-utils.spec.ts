import { findDownloadErrorInCauseChain } from './error-utils';

describe('findDownloadErrorInCauseChain', () => {
	it('should detect TypeError with "Failed to fetch"', () => {
		const error = new TypeError('Failed to fetch');
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should detect TypeError with "Importing a module script failed"', () => {
		const error = new TypeError('Importing a module script failed.');
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should detect "error loading dynamically imported module"', () => {
		const error = new TypeError(
			'error loading dynamically imported module: https://example.com/foo.js'
		);
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should detect Firefox "NetworkError when attempting to fetch"', () => {
		const error = new TypeError(
			'NetworkError when attempting to fetch resource.'
		);
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should detect Safari "Load failed"', () => {
		const error = new TypeError('Load failed');
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should detect WebAssembly.CompileError', () => {
		const error = new WebAssembly.CompileError(
			'expected magic word 00 61 73 6d'
		);
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should detect CompileError via originalErrorClassName (Comlink)', () => {
		const error = new Error('expected magic word 00 61 73 6d');
		(error as any).originalErrorClassName = 'CompileError';
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should detect LinkError', () => {
		const error = new WebAssembly.LinkError(
			'import object field is not a Function'
		);
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should find download error nested in cause chain', () => {
		const downloadError = new TypeError('Failed to fetch');
		const wrapper = new Error('Boot failed', {
			cause: downloadError,
		});
		expect(findDownloadErrorInCauseChain(wrapper)).toBe(downloadError);
	});

	it('should find download error deeply nested in cause chain', () => {
		const downloadError = new TypeError('Failed to fetch');
		const mid = new Error('Step failed', {
			cause: downloadError,
		});
		const outer = new Error('Boot failed', { cause: mid });
		expect(findDownloadErrorInCauseChain(outer)).toBe(downloadError);
	});

	it('should return undefined for non-network errors', () => {
		const error = new Error('Something else went wrong');
		expect(findDownloadErrorInCauseChain(error)).toBeUndefined();
	});

	it('should return undefined for null/undefined', () => {
		expect(findDownloadErrorInCauseChain(null)).toBeUndefined();
		expect(findDownloadErrorInCauseChain(undefined)).toBeUndefined();
	});

	it('should return undefined for non-Error objects', () => {
		expect(
			findDownloadErrorInCauseChain('Failed to fetch')
		).toBeUndefined();
	});

	it('should be case-insensitive for message matching', () => {
		const error = new TypeError('FAILED TO FETCH');
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});
});
