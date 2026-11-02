import {
	basename,
	dirname,
	joinPaths,
	normalizePath,
	resolvePathUnder,
	toPosixPath,
} from '../lib/paths';

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

describe('resolvePathUnder', () => {
	it('resolves relative paths under the parent path', () => {
		expect(resolvePathUnder('wp-content/plugin.php', '/wordpress')).toEqual(
			'/wordpress/wp-content/plugin.php'
		);
	});

	it('normalizes redundant path segments that stay under the parent path', () => {
		expect(
			resolvePathUnder('wp-content/./plugins//plugin.php', '/wordpress')
		).toEqual('/wordpress/wp-content/plugins/plugin.php');
		expect(
			resolvePathUnder('wp-content/../index.php', '/wordpress')
		).toEqual('/wordpress/index.php');
	});

	it('checks absolute paths as already-resolved paths', () => {
		expect(
			resolvePathUnder('/wordpress/wp-content/index.php', '/wordpress')
		).toEqual('/wordpress/wp-content/index.php');
		expect(
			resolvePathUnder('/tmp/index.php', '/wordpress')
		).toBeUndefined();
	});

	it('allows absolute paths under the filesystem root', () => {
		expect(resolvePathUnder('/./tmp/file.php', '/')).toEqual(
			'/tmp/file.php'
		);
		expect(resolvePathUnder('tmp/file.php', '/')).toEqual('/tmp/file.php');
	});

	it('returns undefined for empty or current-directory parent paths', () => {
		expect(resolvePathUnder('file.php', '')).toBeUndefined();
		expect(resolvePathUnder('file.php', '.')).toBeUndefined();
		expect(resolvePathUnder('file.php', './')).toBeUndefined();
		expect(resolvePathUnder('/file.php', '')).toBeUndefined();
	});

	it('returns undefined when the path names the parent itself', () => {
		expect(resolvePathUnder('', '/wordpress')).toBeUndefined();
		expect(resolvePathUnder('.', '/wordpress')).toBeUndefined();
		expect(resolvePathUnder('/wordpress', '/wordpress')).toBeUndefined();
		expect(resolvePathUnder('/wordpress/', '/wordpress')).toBeUndefined();
		expect(resolvePathUnder('/', '/')).toBeUndefined();
	});

	it('returns undefined when the resolved path escapes the parent path', () => {
		expect(resolvePathUnder('../escape.php', '/wordpress')).toBeUndefined();
		expect(
			resolvePathUnder('wp-content/../../escape.php', '/wordpress')
		).toBeUndefined();
		expect(
			resolvePathUnder('/wordpress-backup/file.php', '/wordpress')
		).toBeUndefined();
	});

	it('returns undefined for paths containing null bytes', () => {
		expect(
			resolvePathUnder('wp-content/\0.php', '/wordpress')
		).toBeUndefined();
		expect(
			resolvePathUnder('wp-content/file.php', '/wordpress\0')
		).toBeUndefined();
	});

	it('supports relative parent paths', () => {
		expect(resolvePathUnder('wp-content/plugin.php', 'wordpress')).toEqual(
			'wordpress/wp-content/plugin.php'
		);
		expect(resolvePathUnder('../escape.php', 'wordpress')).toBeUndefined();
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

describe('toPosixPath', () => {
	it('should return POSIX paths unchanged', () => {
		expect(toPosixPath('/home/user/project')).toEqual('/home/user/project');
	});

	it('should convert backslashes to forward slashes', () => {
		expect(toPosixPath('foo\\bar\\baz')).toEqual('foo/bar/baz');
	});

	it('should convert Windows drive letter to POSIX-style root', () => {
		expect(toPosixPath('C:\\Users\\admin')).toEqual('/C/Users/admin');
	});

	it('should handle lowercase drive letters', () => {
		expect(toPosixPath('d:\\projects\\wp')).toEqual('/d/projects/wp');
	});

	it('should handle drive letter with forward slashes', () => {
		expect(toPosixPath('C:/Users/admin')).toEqual('/C/Users/admin');
	});

	it('should leave relative paths unchanged', () => {
		expect(toPosixPath('relative/path')).toEqual('relative/path');
	});

	it('should handle empty string', () => {
		expect(toPosixPath('')).toEqual('');
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
