import {
	staticAnalyzeGitHubURL,
	GitHubURLInformation,
} from './analyze-github-url';

describe('staticAnalyzeGitHubURL', () => {
	it('should return correct GitHubURLInformation for a repo URL', () => {
		const url = 'https://github.com/owner/repo/';
		const expected: GitHubURLInformation = {
			owner: 'owner',
			repo: 'repo',
			type: 'repo',
			ref: undefined,
			path: '',
			pr: undefined,
		};
		expect(staticAnalyzeGitHubURL(url)).toEqual(expected);
	});

	it('should return correct GitHubURLInformation for a PR URL', () => {
		const url = 'https://github.com/owner/repo/pull/123';
		const expected: GitHubURLInformation = {
			owner: 'owner',
			repo: 'repo',
			type: 'pr',
			ref: undefined,
			path: '',
			pr: 123,
		};
		expect(staticAnalyzeGitHubURL(url)).toEqual(expected);
	});

	it('should throw an error for an invalid PR URL', () => {
		const url = 'https://github.com/owner/repo/pull/invalid';
		expect(() => staticAnalyzeGitHubURL(url)).toThrowError(
			'Invalid Pull Request  number NaN parsed from the following GitHub URL: https://github.com/owner/repo/pull/invalid'
		);
	});

	it('should return correct GitHubURLInformation for a branch URL', () => {
		const url = 'https://github.com/owner/repo/tree/branch/path/to/file';
		const expected: GitHubURLInformation = {
			owner: 'owner',
			repo: 'repo',
			type: 'branch',
			ref: 'branch',
			path: 'path/to/file',
			pr: undefined,
		};
		expect(staticAnalyzeGitHubURL(url)).toEqual(expected);
	});

	it('should return correct GitHubURLInformation for a raw file URL', () => {
		const url =
			'https://raw.githubusercontent.com/owner/repo/branch/path/to/file.zip';
		const expected: GitHubURLInformation = {
			owner: 'owner',
			repo: 'repo',
			type: 'rawfile',
			ref: undefined,
			path: 'owner/repo/branch/path/to/file.zip',
		};
		expect(staticAnalyzeGitHubURL(url)).toEqual(expected);
	});

	it('should return correct GitHubURLInformation for a repo URL', () => {
		const url = 'https://github.com/owner/repo';
		const expected: GitHubURLInformation = {
			owner: 'owner',
			repo: 'repo',
			type: 'repo',
			ref: undefined,
			path: '',
		};
		expect(staticAnalyzeGitHubURL(url)).toEqual(expected);
	});
});
