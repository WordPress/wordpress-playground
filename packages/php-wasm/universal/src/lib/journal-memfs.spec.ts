import { normalize } from './journal-memfs';

describe('Filesystem Journaling – normalize()', () => {
	it('Skips creating files that are removed later in the stream', () => {
		expect(
			normalize([
				{ operation: 'CREATE', path: '/test', nodeType: 'file' },
				{ operation: 'CREATE', path: '/test2', nodeType: 'file' },
				{ operation: 'DELETE', path: '/test', nodeType: 'file' },
			])
		).toEqual([{ operation: 'CREATE', path: '/test2', nodeType: 'file' }]);
	});

	it('Skips creating directories that are removed later in the stream', () => {
		expect(
			normalize([
				{ operation: 'CREATE', path: '/test', nodeType: 'directory' },
				{ operation: 'CREATE', path: '/test2', nodeType: 'directory' },
				{ operation: 'DELETE', path: '/test', nodeType: 'directory' },
			])
		).toEqual([
			{ operation: 'CREATE', path: '/test2', nodeType: 'directory' },
		]);
	});

	it('Skips creating files inside directories that are removed later in the stream', () => {
		expect(
			normalize([
				{ operation: 'CREATE', path: '/top-level', nodeType: 'file' },
				{ operation: 'CREATE', path: '/test', nodeType: 'directory' },
				{ operation: 'CREATE', path: '/test/inside', nodeType: 'file' },
				{ operation: 'DELETE', path: '/test', nodeType: 'directory' },
			])
		).toEqual([
			{ operation: 'CREATE', path: '/top-level', nodeType: 'file' },
		]);
	});
});
