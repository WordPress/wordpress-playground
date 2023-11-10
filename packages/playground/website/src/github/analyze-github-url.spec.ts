import { analyzeGitHubURL, GitHubPointer } from './analyze-github-url';

describe('analyzeGitHubURL', () => {
	it('should return correct GitHubPointer for a PR URL', () => {
		const url = 'https://github.com/owner/repo/pull/123';
		const expected: GitHubPointer = {
			owner: 'owner',
			repo: 'repo',
			type: 'pr',
			ref: 'unknown',
			path: '/',
			pr: 123,
		};
		expect(analyzeGitHubURL(url)).toEqual(expected);
	});

	it('should throw an error for an invalid PR URL', () => {
		const url = 'https://github.com/owner/repo/pull/invalid';
		expect(() => analyzeGitHubURL(url)).toThrowError(
			'Invalid Pull Request  number NaN parsed from the following GitHub URL: https://github.com/owner/repo/pull/invalid'
		);
	});

	it('should return correct GitHubPointer for a branch URL', () => {
		const url = 'https://github.com/owner/repo/tree/branch/path/to/file';
		const expected: GitHubPointer = {
			owner: 'owner',
			repo: 'repo',
			type: 'branch',
			ref: 'branch',
			path: 'path/to/file',
			pr: undefined,
		};
		expect(analyzeGitHubURL(url)).toEqual(expected);
	});

	it('should return correct GitHubPointer for a raw file URL', () => {
		const url =
			'https://raw.githubusercontent.com/owner/repo/branch/path/to/file';
		const expected: GitHubPointer = {
			owner: 'owner',
			repo: 'repo',
			type: 'zip',
			ref: 'unknown',
			path: 'path/to/file',
		};
		expect(analyzeGitHubURL(url)).toEqual(expected);
	});

	it('should return correct GitHubPointer for an unknown URL', () => {
		const url = 'https://github.com/owner/repo';
		const expected: GitHubPointer = {
			owner: 'owner',
			repo: 'repo',
			type: 'unknown',
			ref: 'unknown',
			path: '/',
		};
		expect(analyzeGitHubURL(url)).toEqual(expected);
	});
});
