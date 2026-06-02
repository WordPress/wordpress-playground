import { isGitRepoUrl } from '../lib/is-git-repo-url';

describe('isGitRepoUrl', () => {
	it('recognizes Git repository URLs Playground can clone', () => {
		expect(isGitRepoUrl('https://github.com/example/plugin')).toBe(true);
		expect(isGitRepoUrl('https://gitlab.com/example/group/plugin/')).toBe(
			true
		);
		expect(isGitRepoUrl('https://example.com/plugin.git')).toBe(true);
	});

	it('rejects ordinary downloadable URLs', () => {
		expect(isGitRepoUrl('https://example.com/plugin.zip')).toBe(false);
		expect(isGitRepoUrl('https://wordpress.org/plugins/demo/')).toBe(false);
		expect(isGitRepoUrl('https://github.com/example/plugin?foo=bar')).toBe(
			false
		);
		expect(isGitRepoUrl('https://gitlab.com/example/plugin#readme')).toBe(
			false
		);
	});

	it('rejects GitLab reserved subroutes', () => {
		expect(
			isGitRepoUrl('https://gitlab.com/example/plugin/-/tree/main')
		).toBe(false);
		expect(
			isGitRepoUrl('https://gitlab.com/example/plugin/-/blob/main/file.php')
		).toBe(false);
		expect(
			isGitRepoUrl('https://gitlab.com/example/plugin/-/raw/main/file.php')
		).toBe(false);
		expect(
			isGitRepoUrl(
				'https://gitlab.com/example/plugin/-/archive/main/plugin-main.zip'
			)
		).toBe(false);
	});
});
