import type {
	GitDirectoryReference,
	StepDefinition,
} from '@wp-playground/blueprints';

export interface ExtractedGitDirectorySource {
	assetPath: string;
	source: GitDirectoryReference;
}

/**
 * Reads the git:directory provenance (repo URL, ref, path) and the
 * resolved install path off a completed installPlugin/installTheme step,
 * or returns null when the step isn't a git:directory install, or when
 * `ifAlreadyInstalled: 'skip'` left an unrelated pre-existing folder in
 * place rather than actually installing from this resource.
 */
export function extractGitDirectorySource(
	step: StepDefinition,
	result: unknown
): ExtractedGitDirectorySource | null {
	if (step.step !== 'installPlugin' && step.step !== 'installTheme') {
		return null;
	}
	const resource = (step as any).pluginData ?? (step as any).themeData;
	if (
		!resource ||
		typeof resource !== 'object' ||
		resource.resource !== 'git:directory'
	) {
		return null;
	}
	const { assetPath, skippedExisting } =
		(result as
			| { assetPath?: string; skippedExisting?: boolean }
			| undefined) ?? {};
	if (!assetPath || skippedExisting) {
		return null;
	}
	return {
		assetPath,
		source: resource as GitDirectoryReference,
	};
}

/**
 * Fills in a `https://` scheme when the user typed a bare host+path (e.g.
 * `github.com/owner/repo`), so the Mount-via-git URL field doesn't require
 * typing the scheme out.
 */
export function normalizeGitUrl(input: string): string {
	const trimmed = input.trim();
	return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Detects a GitHub "tree" URL (e.g. copied from the branch selector, like
 * `https://github.com/owner/repo/tree/some/branch`) and splits it into the
 * plain repository URL and the ref.
 *
 * The entire remainder after `/tree/` is treated as the ref rather than
 * trying to split it into "branch" + "path" — branch names may themselves
 * contain slashes (e.g. `dist/main`), and there's no reliable way to tell
 * a multi-segment branch name apart from a trailing path without querying
 * the repository.
 */
export function parseGitHubTreeUrl(
	input: string
): { url: string; ref: string } | null {
	const match = input
		.trim()
		.match(
			/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/tree\/(.+)$/i
		);
	if (!match) {
		return null;
	}
	const [, owner, repo, ref] = match;
	return {
		url: `https://github.com/${owner}/${repo.replace(/\.git$/i, '')}`,
		ref,
	};
}

/**
 * Derives a filesystem-safe folder name from a git repository URL, e.g.
 * `https://github.com/WordPress/wordpress-playground` -> `wordpress-playground`.
 */
export function deriveFolderNameFromGitUrl(url: string): string {
	const trimmed = url
		.trim()
		.replace(/\/+$/, '')
		.replace(/\.git$/i, '');
	const lastSegment = trimmed.split('/').pop() || '';
	const sanitized = lastSegment.replace(/[^a-zA-Z0-9-_.]/g, '-');
	return sanitized || 'git-mount';
}
