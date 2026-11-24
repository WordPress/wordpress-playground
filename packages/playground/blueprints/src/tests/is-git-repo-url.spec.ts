import { seemsLikeGitRepoUrl } from '../lib/is-git-repo-url';

describe('seemsLikeGitRepoUrl', () => {
	it('accepts cloneable HTTPS repository URLs', () => {
		expect(seemsLikeGitRepoUrl('https://example.com/project.git')).toBe(
			true
		);
		expect(seemsLikeGitRepoUrl('https://github.com/owner/repo')).toBe(true);
		expect(
			seemsLikeGitRepoUrl('https://gitlab.com/group/subgroup/project')
		).toBe(true);
	});

	it('trims surrounding whitespace and trailing slashes', () => {
		expect(seemsLikeGitRepoUrl(' https://github.com/owner/repo/ ')).toBe(
			true
		);
		expect(seemsLikeGitRepoUrl('https://example.com/project.git/')).toBe(
			true
		);
		expect(
			seemsLikeGitRepoUrl('https://gitlab.com/group/subgroup/project/')
		).toBe(true);
	});

	it('rejects URLs that should be handled as downloads or slugs', () => {
		expect(
			seemsLikeGitRepoUrl(
				'https://github.com/owner/repo/archive/main.zip'
			)
		).toBe(false);
		expect(seemsLikeGitRepoUrl('http://github.com/owner/repo')).toBe(false);
		expect(seemsLikeGitRepoUrl('classic-editor')).toBe(false);
	});
});
