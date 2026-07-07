import { getGitHubImportDirectoryName } from './import-directory-name';

describe('getGitHubImportDirectoryName', () => {
	it('uses the last repository path segment', () => {
		expect(getGitHubImportDirectoryName('plugins/my-plugin', 'repo')).toBe(
			'my-plugin'
		);
	});

	it('falls back to the repository name for root imports', () => {
		expect(getGitHubImportDirectoryName('', 'repo-name')).toBe('repo-name');
	});

	it('does not use dot segments as directory names', () => {
		expect(getGitHubImportDirectoryName('..', 'repo-name')).toBe(
			'repo-name'
		);
		expect(getGitHubImportDirectoryName('.', 'repo-name')).toBe(
			'repo-name'
		);
	});

	it('does not use backslash-separated paths as directory names', () => {
		expect(getGitHubImportDirectoryName('plugins\\my-plugin', 'repo')).toBe(
			'repo'
		);
	});

	it('falls back to a stable name when both inputs are unsafe', () => {
		expect(getGitHubImportDirectoryName('..', '..')).toBe('github-import');
		expect(getGitHubImportDirectoryName('\0', '')).toBe('github-import');
	});

	it('uses only the last segment of fallback repository names', () => {
		expect(getGitHubImportDirectoryName('', 'owner\\repo-name')).toBe(
			'repo-name'
		);
	});
});
