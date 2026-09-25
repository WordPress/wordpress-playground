import { execFileSync } from 'node:child_process';

/**
 * Resolve the two commits the Auto-label diff runs between: the base to diff
 * from and the PR head to diff to.
 *
 * The base is the CURRENT tip of the base branch, fetched fresh from origin —
 * NOT github.event.pull_request.base.sha. That payload SHA is a snapshot that
 * can lag the real branch tip; when it lags the trunk a PR was updated onto, the
 * diff counts those trunk commits as the PR's own changes and mislabels it.
 * Fetching the branch by name re-resolves it to the trunk commit the head really
 * sits on, so trunk churn is excluded regardless of what the webhook reported.
 *
 * Order matters: `git fetch` writes FETCH_HEAD, so each fetch must be followed by
 * its own `rev-parse FETCH_HEAD` before the next fetch overwrites it. The base is
 * resolved first, then the head.
 *
 * @param {string} baseRef - Base BRANCH name (e.g. "trunk").
 * @param {string|number} prNumber - Pull request number.
 * @returns {{ base: string, head: string }} Resolved commit SHAs.
 */
export function resolveDiffRevisions(baseRef, prNumber) {
	execFileSync('git', ['fetch', '--no-tags', 'origin', baseRef], {
		stdio: 'inherit',
	});
	const base = revParse('FETCH_HEAD');

	execFileSync(
		'git',
		['fetch', '--no-tags', 'origin', `refs/pull/${prNumber}/head`],
		{ stdio: 'inherit' }
	);
	const head = revParse('FETCH_HEAD');

	return { base, head };
}

function revParse(rev) {
	return execFileSync('git', ['rev-parse', rev]).toString().trim();
}
