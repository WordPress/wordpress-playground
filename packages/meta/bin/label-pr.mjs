#!/usr/bin/env node
//
// Thin I/O runner for the Auto-label workflow. ALL labeling logic lives in (and
// is unit-tested by) ../src/pr-labels/*.mjs; this file only performs the side
// effects the workflow needs.
//
// There is a single labeling flow: one `git diff` produces every label set
// (path globs, package ranking, PR-title type). It exists because actions/labeler
// and GitHub's pulls.listFiles API generate the full PR diff, which times out on
// PRs with heavy binary churn (recompiled PHP.wasm builds) and blocks the merge.
// `git diff` compares tree hashes locally, so it is instant regardless of PR
// size.
//
// The label rules (path globs, package prefixes, title prefixes) live in the
// ../src/pr-labels/*.mjs modules, so this runner only reads the PR facts the
// workflow passes in — no config files, no event payload.
//
// Inputs (all provided by the workflow):
//   PR_NUMBER          pull request number
//   BASE_REF           base BRANCH name (e.g. "trunk"). We diff against the
//                      branch's current tip, which the webhook's base.sha can
//                      lag behind.
//   PR_TITLE           PR title (for the conventional-commit [Type] label)
//   GITHUB_REPOSITORY  "owner/repo"
//   GITHUB_TOKEN       token with pull-requests:write
//
// (The label modules' only dependency is installed from
// ../src/pr-labels/package.json before this runs; it resolves via a normal
// import.)
import { matchPathLabels } from '../src/pr-labels/match-path-labels.mjs';
import { rankPackageLabels } from '../src/pr-labels/rank-package-labels.mjs';
import { matchTypeLabel } from '../src/pr-labels/match-type-label.mjs';
import { changedFileStats } from '../src/pr-labels/git-numstat.mjs';
import { resolveDiffRevisions } from '../src/pr-labels/resolve-revisions.mjs';

const prNumber = requireEnv('PR_NUMBER');
const baseRef = requireEnv('BASE_REF');
const prTitle = requireEnv('PR_TITLE');

// Resolve the commits to diff: the current tip of the base branch (fetched
// fresh, not the webhook's stale base.sha) and the PR head. See
// resolve-revisions.mjs for why the base is re-resolved by branch name.
const { base, head } = resolveDiffRevisions(baseRef, prNumber);

// One `git diff --numstat` feeds both the changed-file list (for path globs) and
// the per-file line counts (for package ranking). git-numstat.mjs owns the diff
// invocation and its flags (-z, --no-renames) and parses the result.
const fileStats = changedFileStats(base, head);
const changedFiles = fileStats.map((f) => f.path);

const labels = [
	...matchPathLabels(changedFiles),
	...rankPackageLabels(fileStats),
];
const typeLabel = matchTypeLabel(prTitle);
if (typeLabel) {
	labels.push(typeLabel);
}
// De-dup: e.g. [Type] Documentation can come from both a path glob and the
// title.
const computedLabels = [...new Set(labels)];
console.log(
	`Changed files: ${changedFiles.length}. Computed labels: ${JSON.stringify(
		computedLabels
	)}`
);
if (computedLabels.length === 0) {
	console.log('No labels matched; nothing to do.');
	process.exit(0);
}

// Add only the labels not already on the PR, and log the delta so each run is a
// clear record of what it changed. This flow only ever ADDS labels (it never
// removes), matching the previous actions/labeler `sync-labels: false` setting.
const [owner, repo] = requireEnv('GITHUB_REPOSITORY').split('/');
const token = requireEnv('GITHUB_TOKEN');

const currentLabels = (
	await githubApi('GET', `/issues/${prNumber}/labels?per_page=100`)
).map((label) => label.name);
const alreadyPresent = computedLabels.filter((label) =>
	currentLabels.includes(label)
);
const labelsToAdd = computedLabels.filter(
	(label) => !currentLabels.includes(label)
);
console.log(`Already present: ${JSON.stringify(alreadyPresent)}`);

if (labelsToAdd.length === 0) {
	console.log('All computed labels already present; no changes to make.');
	process.exit(0);
}

console.log(`Adding labels: ${JSON.stringify(labelsToAdd)}`);
const updatedLabels = await githubApi('POST', `/issues/${prNumber}/labels`, {
	labels: labelsToAdd,
});
console.log(
	`Done. Labels on PR now: ${JSON.stringify(
		updatedLabels.map((label) => label.name).sort()
	)}`
);

async function githubApi(method, path, body) {
	const response = await fetch(
		`https://api.github.com/repos/${owner}/${repo}${path}`,
		{
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28',
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		}
	);
	if (!response.ok) {
		throw new Error(
			`${method} ${path} failed (${response.status}): ${await response.text()}`
		);
	}
	return response.json();
}

function requireEnv(name) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}
