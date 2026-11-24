/**
 * Heuristically indicates whether a URL looks like a Git repository.
 *
 * Blueprint compilers use this to distinguish plugin/theme repository URLs
 * from downloadable ZIP URLs. This is intentionally a small allowlist of URL
 * shapes Playground can clone, not a general Git remote detector.
 */
export function seemsLikeGitRepoUrl(url: string): boolean {
	const normalizedUrl = url.trim().replace(/\/+$/, '');

	// Explicit Git clone URLs can point to any HTTPS host.
	if (/^https:\/\/.+\.git$/.test(normalizedUrl)) {
		return true;
	}

	// GitHub shorthand: exactly /owner/repo.
	if (/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(normalizedUrl)) {
		return true;
	}

	// GitLab shorthand: /group[/subgroup...]/project.
	return /^https:\/\/gitlab\.com\/[^/]+\/[^/]+(\/[^/]+)*$/.test(
		normalizedUrl
	);
}
