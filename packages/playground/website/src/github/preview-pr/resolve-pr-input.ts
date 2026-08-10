export type ResolvedRef = {
	target: 'wordpress' | 'gutenberg';
	ref: string;
	isBranch: boolean;
};

export type ResolvePrInputResult =
	| { ok: true; value: ResolvedRef }
	| { ok: false; error: string };

// WordPress Core builds artifacts per pull request, not per branch, so a branch
// name (or branch URL) can't be previewed. Gutenberg branches still work.
const WP_BRANCH_ERROR =
	"Branch names aren't supported for WordPress Core — paste a pull request number or URL instead. (To preview a Gutenberg branch, paste its full GitHub branch URL.)";
const PULL_REQUEST_NUMBER = /^[1-9]\d*$/;
const FIRST_WORDPRESS_PREVIEWABLE_PR = 5749;

/**
 * Resolves free-form input into a repository + reference. A recognized GitHub
 * URL decides the repository; a bare number is a pull request on the preferred
 * repository; anything else is a branch name, which only Gutenberg supports.
 */
export function resolvePrInput(
	raw: string,
	preferredTarget: 'wordpress' | 'gutenberg'
): ResolvePrInputResult {
	const input = raw.trim();
	if (!input) {
		return { ok: false, error: 'Enter a pull request number or URL.' };
	}

	// Extract number from a GitHub URL. Recognized URLs decide the
	// repository even when the modal was opened for the other target.
	const githubUrl = parseGitHubUrl(input);
	if (githubUrl) {
		const hostname = githubUrl.hostname.toLowerCase();
		if (
			!['http:', 'https:'].includes(githubUrl.protocol) ||
			(hostname !== 'github.com' && hostname !== 'www.github.com')
		) {
			return {
				ok: false,
				error: 'Paste a WordPress Core or Gutenberg pull request URL, or a Gutenberg branch URL.',
			};
		}
		let githubPath = undefined;
		try {
			githubPath = decodeURIComponent(githubUrl.pathname);
		} catch {
			return {
				ok: false,
				error: 'Paste a WordPress Core or Gutenberg pull request URL, or a Gutenberg branch URL.',
			};
		}
		const [owner, repoRaw, kindRaw, ...rest] = githubPath
			.split('/')
			.filter(Boolean);
		if (owner?.toLowerCase() !== 'wordpress') {
			return {
				ok: false,
				error: 'Only WordPress/wordpress-develop and WordPress/gutenberg URLs are supported.',
			};
		}
		const repo = repoRaw?.toLowerCase();
		const kind = kindRaw?.toLowerCase();
		if (
			repo === 'gutenberg' &&
			kind === 'pull' &&
			PULL_REQUEST_NUMBER.test(rest[0])
		) {
			return {
				ok: true,
				value: {
					target: 'gutenberg',
					ref: rest[0],
					isBranch: false,
				},
			};
		}
		if (repo === 'gutenberg' && kind === 'tree' && rest.length > 0) {
			return {
				ok: true,
				value: {
					target: 'gutenberg',
					ref: rest.join('/').replace(/\/+$/, ''),
					isBranch: true,
				},
			};
		}
		if (
			repo === 'wordpress-develop' &&
			kind === 'pull' &&
			PULL_REQUEST_NUMBER.test(rest[0])
		) {
			return {
				ok: true,
				value: {
					target: 'wordpress',
					ref: rest[0],
					isBranch: false,
				},
			};
		}
		if (repo === 'wordpress-develop' && kind === 'tree') {
			return { ok: false, error: WP_BRANCH_ERROR };
		}
		return {
			ok: false,
			error: 'Paste a WordPress Core or Gutenberg pull request URL, or a Gutenberg branch URL.',
		};
	}

	// Bare numbers are PR numbers for whichever repository the modal prefers.
	if (PULL_REQUEST_NUMBER.test(input)) {
		return {
			ok: true,
			value: { target: preferredTarget, ref: input, isBranch: false },
		};
	}
	if (/^\d+$/.test(input)) {
		return { ok: false, error: 'Enter a valid pull request number.' };
	}

	// Bare, non-numeric, no recognized URL: treat as a branch name. Gutenberg
	// supports branches; WordPress Core does not.
	if (preferredTarget === 'gutenberg') {
		return {
			ok: true,
			value: { target: 'gutenberg', ref: input, isBranch: true },
		};
	}
	return { ok: false, error: WP_BRANCH_ERROR };
}

export function isWordPressPrBeforePreviewer(resolved: ResolvedRef) {
	return (
		resolved.target === 'wordpress' &&
		!resolved.isBranch &&
		PULL_REQUEST_NUMBER.test(resolved.ref) &&
		Number(resolved.ref) < FIRST_WORDPRESS_PREVIEWABLE_PR
	);
}

function parseGitHubUrl(input: string): URL | undefined {
	try {
		return new URL(input);
	} catch {
		if (!/^github\.com\//i.test(input)) {
			return undefined;
		}
		try {
			return new URL(`https://${input}`);
		} catch {
			return undefined;
		}
	}
}
