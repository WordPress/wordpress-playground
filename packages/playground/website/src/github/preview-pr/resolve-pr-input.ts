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

	const gutenbergPr = input.match(
		/github\.com\/[^/]+\/gutenberg\/pull\/(\d+)/i
	);
	if (gutenbergPr) {
		return {
			ok: true,
			value: {
				target: 'gutenberg',
				ref: gutenbergPr[1],
				isBranch: false,
			},
		};
	}

	const gutenbergBranch = input.match(
		/github\.com\/[^/]+\/gutenberg\/tree\/(.+)$/i
	);
	if (gutenbergBranch) {
		return {
			ok: true,
			value: {
				target: 'gutenberg',
				ref: gutenbergBranch[1].replace(/\/+$/, ''),
				isBranch: true,
			},
		};
	}

	const wordpressPr = input.match(
		/github\.com\/[^/]+\/wordpress-develop\/pull\/(\d+)/i
	);
	if (wordpressPr) {
		return {
			ok: true,
			value: {
				target: 'wordpress',
				ref: wordpressPr[1],
				isBranch: false,
			},
		};
	}

	if (/github\.com\/[^/]+\/wordpress-develop\/tree\//i.test(input)) {
		return { ok: false, error: WP_BRANCH_ERROR };
	}

	if (/^\d+$/.test(input)) {
		return {
			ok: true,
			value: { target: preferredTarget, ref: input, isBranch: false },
		};
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
