import type { GitHubURLInformation } from './analyze-github-url';
import {
	resolveGitHubBranchPath,
	staticAnalyzeGitHubURL,
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

	it('should accept www.github.com URLs', () => {
		expect(
			staticAnalyzeGitHubURL('https://www.github.com/owner/repo')
		).toMatchObject({
			owner: 'owner',
			repo: 'repo',
			type: 'repo',
		});
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

	it('should reject an invalid PR URL', () => {
		const url = 'https://github.com/owner/repo/pull/invalid';
		expect(staticAnalyzeGitHubURL(url)).toEqual({
			type: 'unknown',
		});
		expect(
			staticAnalyzeGitHubURL('https://github.com/owner/repo/pull/123abc')
		).toEqual({
			type: 'unknown',
		});
		expect(
			staticAnalyzeGitHubURL('https://github.com/owner/repo/pull/0')
		).toEqual({
			type: 'unknown',
		});
	});

	it('should reject non-GitHub URLs', () => {
		const url = 'https://example.com/owner/repo';
		expect(staticAnalyzeGitHubURL(url)).toEqual({
			type: 'unknown',
		});
	});

	it('should reject non-web GitHub URLs', () => {
		expect(staticAnalyzeGitHubURL('ftp://github.com/owner/repo')).toEqual({
			type: 'unknown',
		});
	});

	it('should reject incomplete GitHub URLs', () => {
		expect(staticAnalyzeGitHubURL('https://github.com/owner')).toEqual({
			type: 'unknown',
		});
		expect(
			staticAnalyzeGitHubURL('https://github.com/owner/repo/tree')
		).toEqual({
			type: 'unknown',
		});
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
			branchPathSegments: ['branch', 'path', 'to', 'file'],
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

describe('resolveGitHubBranchPath', () => {
	it('uses the longest existing branch prefix for tree URLs', async () => {
		const octokit = {
			rest: {
				repos: {
					getBranch: async ({ branch }: { branch: string }) => {
						if (branch === 'feature/foo') {
							return {
								data: {
									commit: {
										sha: 'abc123',
									},
								},
							};
						}
						const error = new Error('Not found') as Error & {
							status?: number;
						};
						error.status = 404;
						throw error;
					},
				},
			},
		};

		await expect(
			resolveGitHubBranchPath(
				octokit,
				staticAnalyzeGitHubURL(
					'https://github.com/owner/repo/tree/feature/foo/src'
				)
			)
		).resolves.toMatchObject({
			type: 'branch',
			ref: 'feature/foo',
			commitSha: 'abc123',
			path: 'src',
		});
	});
});
