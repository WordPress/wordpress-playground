/**
 * Heuristically indicates whether a URL looks like a Git repository.
 *
 * Blueprint compilers use this to distinguish plugin/theme repository URLs
 * from downloadable ZIP URLs. This is intentionally a small allowlist of URL
 * shapes Playground can clone, not a general Git remote detector.
 */
export function seemsLikeGitRepoUrl(url: string): boolean {
	const normalizedUrl = url.trim().replace(/\/+$/, '');
	let parsed: URL;
	try {
		parsed = new URL(normalizedUrl);
	} catch {
		return false;
	}

	if (
		parsed.protocol !== 'https:' ||
		parsed.search.length > 0 ||
		parsed.hash.length > 0
	) {
		return false;
	}

	// Explicit Git clone URLs can point to any HTTPS host.
	if (parsed.pathname.endsWith('.git')) {
		return true;
	}

	// GitHub shorthand: exactly /owner/repo.
	const segments = parsed.pathname.split('/').filter(Boolean);
	if (parsed.hostname === 'github.com') {
		return segments.length === 2;
	}

	// GitLab shorthand: /group[/subgroup...]/project.
	// GitLab uses "/-/" for tree, archive, and other non-repository pages.
	return (
		parsed.hostname === 'gitlab.com' &&
		segments.length >= 2 &&
		!segments.includes('-')
	);
}
