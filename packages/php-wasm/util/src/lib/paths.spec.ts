import { basename, dirname, joinPaths, normalizePath } from './paths';

describe('joinPaths', () => {
	it('should join paths correctly', () => {
		expect(joinPaths('wordpress', 'wp-content')).toEqual(
			'wordpress/wp-content'
		);
		expect(joinPaths('/wordpress', 'wp-content')).toEqual(
			'/wordpress/wp-content'
		);
		expect(joinPaths('wordpress', 'wp-content/')).toEqual(
			'wordpress/wp-content/'
		);
		expect(joinPaths('wordpress/', '/wp-content')).toEqual(
			'wordpress/wp-content'
		);
		expect(joinPaths('wordpress', '..', 'wp-content')).toEqual(
			'wp-content'
		);
		expect(joinPaths('wordpress', '..', '..', 'wp-content')).toEqual(
			'../wp-content'
		);
		expect(joinPaths('/', '/')).toEqual('/');
	});
});

describe('normalizePath', () => {
	it('should remove redundant segments and slashes', () => {
		expect(normalizePath('wordpress//wp-content/../')).toEqual('wordpress');
	});
	it('should remove the trailing slash', () => {
		expect(normalizePath('wordpress/wp-content/')).toEqual(
			'wordpress/wp-content'
		);
	});
	it('should preserve the leading slash', () => {
		expect(normalizePath('/wordpress/wp-content')).toEqual(
			'/wordpress/wp-content'
		);
	});
});

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

describe('dirname', () => {
	it('should return the directory name of a path', () => {
		expect(dirname('/path/to/file.txt')).toEqual('/path/to');
		expect(dirname('/path/to/directory/')).toEqual('/path/to');
		expect(dirname('/path/to//file')).toEqual('/path/to');
		expect(dirname('/path/to')).toEqual('/path');
		expect(dirname('/')).toEqual('/');
		expect(dirname('')).toEqual('');
		expect(dirname('/path/to/')).toEqual('/path');
		expect(dirname('/path')).toEqual('/');
		expect(dirname('path/to/file.txt')).toEqual('path/to');
		expect(dirname('path/to/directory/')).toEqual('path/to');
		expect(dirname('path/to/')).toEqual('path');
		expect(dirname('path')).toEqual('');
	});
});
