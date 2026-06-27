import { isGitRepoUrl, seemsLikeGitRepoUrl } from '../lib/is-git-repo-url';

describe('seemsLikeGitRepoUrl', () => {
	it('recognizes Git repository URLs Playground can clone', () => {
		expect(seemsLikeGitRepoUrl('https://github.com/example/plugin')).toBe(
			true
		);
		expect(
			seemsLikeGitRepoUrl('https://gitlab.com/example/group/plugin/')
		).toBe(true);
		expect(seemsLikeGitRepoUrl('https://example.com/plugin.git')).toBe(
			true
		);
	});

	it('rejects ordinary downloadable URLs', () => {
		expect(seemsLikeGitRepoUrl('https://example.com/plugin.zip')).toBe(
			false
		);
		expect(seemsLikeGitRepoUrl('https://wordpress.org/plugins/demo/')).toBe(
			false
		);
		expect(
			seemsLikeGitRepoUrl('https://github.com/example/plugin?foo=bar')
		).toBe(false);
		expect(
			seemsLikeGitRepoUrl('https://gitlab.com/example/plugin#readme')
		).toBe(false);
	});

	it('rejects GitLab reserved subroutes', () => {
		expect(
			seemsLikeGitRepoUrl('https://gitlab.com/example/plugin/-/tree/main')
		).toBe(false);
		expect(
			seemsLikeGitRepoUrl(
				'https://gitlab.com/example/plugin/-/blob/main/file.php'
			)
		).toBe(false);
		expect(
			seemsLikeGitRepoUrl(
				'https://gitlab.com/example/plugin/-/raw/main/file.php'
			)
		).toBe(false);
		expect(
			seemsLikeGitRepoUrl(
				'https://gitlab.com/example/plugin/-/archive/main/plugin-main.zip'
			)
		).toBe(false);
	});

	it('keeps the old export as a compatibility alias', () => {
		expect(isGitRepoUrl).toBe(seemsLikeGitRepoUrl);
	});
});
