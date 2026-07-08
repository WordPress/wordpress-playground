import {
	getGitHubImportDirectoryName,
	normalizeGitHubImportPath,
} from './import-paths';

describe('normalizeGitHubImportPath', () => {
	it('normalizes slashes and current-directory segments', () => {
		expect(normalizeGitHubImportPath('/packages//plugin/.')).toBe(
			'packages/plugin'
		);
		expect(normalizeGitHubImportPath('packages\\plugin')).toBe(
			'packages/plugin'
		);
		expect(normalizeGitHubImportPath(' /packages/plugin ')).toBe(
			'packages/plugin'
		);
	});

	it('rejects parent traversal segments', () => {
		expect(() => normalizeGitHubImportPath('../plugin')).toThrow(
			'Repository path cannot contain ".." segments.'
		);
		expect(() => normalizeGitHubImportPath('packages/../plugin')).toThrow(
			'Repository path cannot contain ".." segments.'
		);
	});

	it('rejects null bytes', () => {
		expect(() => normalizeGitHubImportPath('packages/\0plugin')).toThrow(
			'Repository path cannot contain null bytes.'
		);
	});
});

describe('getGitHubImportDirectoryName', () => {
	it('uses the selected repo directory name when present', () => {
		expect(getGitHubImportDirectoryName('packages/my-plugin', 'repo')).toBe(
			'my-plugin'
		);
	});

	it('falls back to the repo name for root imports', () => {
		expect(getGitHubImportDirectoryName('', 'repo')).toBe('repo');
	});

	it('keeps fallback repo names to a single safe path segment', () => {
		expect(getGitHubImportDirectoryName('', '../repo')).toBe('repo');
		expect(getGitHubImportDirectoryName('', '..')).toBe('github-import');
		expect(getGitHubImportDirectoryName('', 'repo\0name')).toBe(
			'github-import'
		);
	});
});
