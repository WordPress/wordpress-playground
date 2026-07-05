import {
	filterRepositoryFilesToScopes,
	isRepositoryPathInsideScope,
	joinRepositoryPath,
	normalizePlaygroundPath,
	normalizeRepositoryPath,
	relativePathFromRoot,
	resolvePathInsideRoot,
} from './export-paths';

describe('normalizePlaygroundPath', () => {
	it('normalizes Playground filesystem paths to absolute paths', () => {
		expect(
			normalizePlaygroundPath('/wordpress/wp-content/../index.php')
		).toBe('/wordpress/index.php');
		expect(normalizePlaygroundPath('wordpress/wp-content')).toBe(
			'/wordpress/wp-content'
		);
		expect(normalizePlaygroundPath('wordpress\\wp-content')).toBe(
			'/wordpress/wp-content'
		);
	});

	it('rejects empty paths and relative paths above the filesystem root', () => {
		expect(normalizePlaygroundPath('')).toBeUndefined();
		expect(normalizePlaygroundPath('../outside')).toBeUndefined();
		expect(normalizePlaygroundPath('/wordpress/\0outside')).toBeUndefined();
	});
});

describe('isRepositoryPathInsideScope', () => {
	it('matches only the selected file for file scopes', () => {
		expect(
			isRepositoryPathInsideScope('wp-content/plugins/plugin.php', {
				path: 'wp-content/plugins/plugin.php',
				recursive: false,
			})
		).toBe(true);
		expect(
			isRepositoryPathInsideScope('wp-content/plugins/other.php', {
				path: 'wp-content/plugins/plugin.php',
				recursive: false,
			})
		).toBe(false);
	});

	it('matches descendants for recursive directory scopes', () => {
		expect(
			isRepositoryPathInsideScope('wp-content/plugins/demo/file.php', {
				path: 'wp-content/plugins/demo',
				recursive: true,
			})
		).toBe(true);
		expect(
			isRepositoryPathInsideScope('wp-content/plugins/demo.php', {
				path: 'wp-content/plugins/demo',
				recursive: true,
			})
		).toBe(false);
	});

	it('treats the repository root scope as all files', () => {
		expect(
			isRepositoryPathInsideScope('wp-content/plugins/demo/file.php', {
				path: '/',
				recursive: true,
			})
		).toBe(true);
	});

	it('does not treat an exact root file scope as the whole repository', () => {
		expect(
			isRepositoryPathInsideScope('README.md', {
				path: '/',
				recursive: false,
			})
		).toBe(false);
	});
});

describe('filterRepositoryFilesToScopes', () => {
	it('keeps deletions scoped to the exported directory', () => {
		const files = {
			'README.md': 1,
			'wp-content/plugins/demo/plugin.php': 2,
			'wp-content/themes/demo/style.css': 3,
		};

		expect(
			filterRepositoryFilesToScopes(files, [
				{ path: 'wp-content', recursive: true },
			])
		).toEqual({
			'wp-content/plugins/demo/plugin.php': 2,
			'wp-content/themes/demo/style.css': 3,
		});
	});

	it('matches exact file scopes without including siblings', () => {
		const files = {
			'wp-content/plugins/demo/plugin.php': 1,
			'wp-content/plugins/demo/readme.txt': 2,
		};

		expect(
			filterRepositoryFilesToScopes(files, [
				{
					path: 'wp-content/plugins/demo/plugin.php',
					recursive: false,
				},
			])
		).toEqual({
			'wp-content/plugins/demo/plugin.php': 1,
		});
	});
});

describe('normalizeRepositoryPath', () => {
	it('normalizes safe repository paths', () => {
		expect(normalizeRepositoryPath('/wp-content/themes/../plugins')).toBe(
			'wp-content/plugins'
		);
		expect(normalizeRepositoryPath(' wp-content/plugins ')).toBe(
			'wp-content/plugins'
		);
		expect(normalizeRepositoryPath('wp-content\\plugins')).toBe(
			'wp-content/plugins'
		);
		expect(normalizeRepositoryPath('/')).toBe('.');
		expect(normalizeRepositoryPath('')).toBe('.');
	});

	it('rejects paths above the repository root', () => {
		expect(normalizeRepositoryPath('../outside')).toBeUndefined();
		expect(normalizeRepositoryPath('/../../outside')).toBeUndefined();
		expect(normalizeRepositoryPath('wp-content/\0outside')).toBeUndefined();
	});
});

describe('joinRepositoryPath', () => {
	it('joins repository paths without adding a trailing slash for empty child paths', () => {
		expect(joinRepositoryPath('wp-content/plugin.php', '')).toBe(
			'wp-content/plugin.php'
		);
		expect(joinRepositoryPath('.', 'playground.zip')).toBe(
			'playground.zip'
		);
		expect(joinRepositoryPath('wp-content', 'plugins/demo.php')).toBe(
			'wp-content/plugins/demo.php'
		);
	});

	it('rejects joined paths that escape the repository root', () => {
		expect(joinRepositoryPath('wp-content', '../outside')).toBeUndefined();
	});
});

describe('resolvePathInsideRoot', () => {
	it('resolves paths relative to the Playground root', () => {
		expect(
			resolvePathInsideRoot('/wordpress/wp-content', 'plugins/plugin.php')
		).toBe('/wordpress/wp-content/plugins/plugin.php');
		expect(resolvePathInsideRoot('/wordpress/wp-content', './')).toBe(
			'/wordpress/wp-content'
		);
		expect(resolvePathInsideRoot('wp-content', 'plugins/plugin.php')).toBe(
			'/wp-content/plugins/plugin.php'
		);
		expect(
			resolvePathInsideRoot(
				'/wordpress/wp-content',
				'plugins\\plugin.php'
			)
		).toBe('/wordpress/wp-content/plugins/plugin.php');
	});

	it('rejects paths that escape the Playground root', () => {
		expect(
			resolvePathInsideRoot('/wordpress/wp-content', '../wp-config.php')
		).toBeUndefined();
		expect(
			resolvePathInsideRoot('/wordpress/wp-content', 'plugins/\0demo')
		).toBeUndefined();
	});
});

describe('relativePathFromRoot', () => {
	it('computes the repository path relative to the export root', () => {
		expect(
			relativePathFromRoot(
				'/wordpress/wp-content',
				'/wordpress/wp-content/plugins/plugin.php'
			)
		).toBe('plugins/plugin.php');
	});

	it('throws when the exported file is outside the export root', () => {
		expect(() =>
			relativePathFromRoot(
				'wordpress/wp-content',
				'wordpress/wp-config.php'
			)
		).toThrow('outside');
	});
});
