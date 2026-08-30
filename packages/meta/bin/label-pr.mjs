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
//   BASE_SHA           base commit SHA to diff the PR head against
//   PR_TITLE           PR title (for the conventional-commit [Type] label)
//   GITHUB_REPOSITORY  "owner/repo"
//   GITHUB_TOKEN       token with pull-requests:write
//
// (The label modules' only dependency is installed from
// ../src/pr-labels/package.json before this runs; it resolves via a normal
// import.)
import { execFileSync } from 'node:child_process';
import { matchPathLabels } from '../src/pr-labels/match-path-labels.mjs';
import { rankPackageLabels } from '../src/pr-labels/rank-package-labels.mjs';
import { matchTypeLabel } from '../src/pr-labels/match-type-label.mjs';
import { parseGitNumstat } from '../src/pr-labels/parse-git-numstat.mjs';

const prNumber = requireEnv('PR_NUMBER');
const baseSha = requireEnv('BASE_SHA');
const prTitle = requireEnv('PR_TITLE');

const git = (...args) => execFileSync('git', args).toString();
execFileSync(
	'git',
	['fetch', '--no-tags', 'origin', `refs/pull/${prNumber}/head`],
	{ stdio: 'inherit' }
);
const head = git('rev-parse', 'FETCH_HEAD').trim();

// One `git diff --numstat` yields both the changed-file list (for path globs)
// and per-file line counts (for package ranking). See parse-git-numstat.mjs.
const fileStats = parseGitNumstat(
	git('diff', '--numstat', `${baseSha}...${head}`)
);
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
// title. GitHub's addLabels is idempotent, but a clean set keeps logs readable.
const uniqueLabels = [...new Set(labels)];

console.log(
	`Changed files: ${changedFiles.length}. Labels: ${JSON.stringify(
		uniqueLabels
	)}`
);
if (uniqueLabels.length === 0) {
	process.exit(0);
}

const [owner, repo] = requireEnv('GITHUB_REPOSITORY').split('/');
const response = await fetch(
	`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/labels`,
	{
		method: 'POST',
		headers: {
			Authorization: `Bearer ${requireEnv('GITHUB_TOKEN')}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
		},
		body: JSON.stringify({ labels: uniqueLabels }),
	}
);
if (!response.ok) {
	throw new Error(
		`Failed to add labels (${response.status}): ${await response.text()}`
	);
}

function requireEnv(name) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}
