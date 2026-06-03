/**
 * Heuristically indicates whether a URL looks like a Git repository.
 *
 * The Query API and Blueprint compilers use this to distinguish plugin/theme
 * repository URLs from downloadable ZIP URLs. This is intentionally a small
 * allowlist of URL shapes Playground can clone, not a general Git remote
 * detector. Keep the rule centralized so those entry points cannot classify
 * the same string differently.
 */
export function seemsLikeGitRepoUrl(url: string): boolean {
	try {
		const parsed = new URL(url.trim());
		if (parsed.protocol !== 'https:' || parsed.search || parsed.hash) {
			return false;
		}

		const pathname = parsed.pathname.replace(/\/+$/, '');
		const pathSegments = pathname.split('/').filter(Boolean);
		if (pathname.endsWith('.git')) {
			return true;
		}
		if (parsed.hostname === 'github.com') {
			return pathSegments.length === 2;
		}
		if (parsed.hostname === 'gitlab.com') {
			if (pathSegments.includes('-')) {
				return false;
			}
			return pathSegments.length >= 2;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * @deprecated Use `seemsLikeGitRepoUrl()` to make the heuristic explicit.
 */
export const isGitRepoUrl = seemsLikeGitRepoUrl;
