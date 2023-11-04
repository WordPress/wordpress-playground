import { basename } from './basename';

describe('basename', () => {
	it('should return empty string for empty path', () => {
		expect(basename('')).toEqual('');
	});

	it('should return the basename of a path with a file extension', () => {
		expect(basename('/path/to/file.txt')).toEqual('file.txt');
	});

	it('should return the basename of a path without a file extension', () => {
		expect(basename('/path/to/file')).toEqual('file');
	});

	it('should return the basename of a path with a trailing slash', () => {
		expect(basename('/path/to/directory/')).toEqual('directory');
	});

	it('should return the basename of a path with multiple slashes', () => {
		expect(basename('/path/to//file')).toEqual('file');
	});
});
