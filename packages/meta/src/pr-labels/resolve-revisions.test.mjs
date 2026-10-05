import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveDiffRevisions } from './resolve-revisions.mjs';

// Run locally with:
//   node --test "packages/meta/src/pr-labels/**/*.test.mjs"

// resolveDiffRevisions() fetches from a remote named "origin" and runs in
// process.cwd() (in the workflow, the checked-out repo). To test it for real —
// no mocks — we stand up two repos:
//
//   origin  a bare-ish repo holding the "trunk" branch and a refs/pull/1/head
//           ref, exactly the refs the runner fetches.
//   local   a repo whose "origin" remote points at that first repo; the function
//           runs here (cwd), fetches, and resolves the SHAs.
//
// Then we assert the RETURNED commits, which is the contract that matters:
//   base === the current trunk tip (NOT some stale commit), and
//   head === the PR head.
test('resolveDiffRevisions returns the current base-branch tip and the PR head', () => {
	const originDir = mkdtempSync(join(tmpdir(), 'resolve-rev-origin-'));
	const localDir = mkdtempSync(join(tmpdir(), 'resolve-rev-local-'));
	const git = (cwd, ...args) =>
		execFileSync('git', args, { cwd }).toString().trim();
	const commit = (cwd, path, message) => {
		writeFileSync(join(cwd, path), `${message}\n`);
		git(cwd, 'add', path);
		git(cwd, 'commit', '--quiet', '-m', message);
		return git(cwd, 'rev-parse', 'HEAD');
	};

	const originalCwd = process.cwd();
	try {
		// Build the "origin" repo's trunk. The first commit stands in for an older
		// trunk state (the kind of stale commit the webhook's base.sha might
		// report); the second is the CURRENT trunk tip we expect back as `base`.
		git(originDir, 'init', '--quiet', '-b', 'trunk');
		git(originDir, 'config', 'user.email', 'test@example.com');
		git(originDir, 'config', 'user.name', 'Test');
		const olderTrunk = commit(originDir, 'base.txt', 'older trunk');
		const currentTrunkTip = commit(
			originDir,
			'trunk-only.wasm',
			'newer trunk'
		);

		// The PR head: built on the current trunk tip, adding one file, and
		// published on origin as refs/pull/1/head like GitHub does.
		git(originDir, 'checkout', '--quiet', '-b', 'pr', currentTrunkTip);
		const prHead = commit(originDir, 'pr.ts', 'pr work');
		git(originDir, 'update-ref', 'refs/pull/1/head', prHead);
		// Leave origin's checked-out branch on trunk so `trunk` resolves to
		// currentTrunkTip for the fetch below.
		git(originDir, 'checkout', '--quiet', 'trunk');

		// The local repo the runner executes in, with origin wired to the repo above.
		git(localDir, 'init', '--quiet');
		git(localDir, 'remote', 'add', 'origin', originDir);
		process.chdir(localDir);

		const { base, head } = resolveDiffRevisions('trunk', 1);

		// base is the CURRENT trunk tip, not the older commit — the whole point of
		// resolving the branch name against origin instead of trusting a snapshot.
		assert.equal(base, currentTrunkTip);
		assert.notEqual(base, olderTrunk);
		// head is the PR head published under refs/pull/1/head.
		assert.equal(head, prHead);
		// And they are distinct — a regression that fetched the head before
		// capturing the base's FETCH_HEAD would collapse base onto head.
		assert.notEqual(base, head);
	} finally {
		process.chdir(originalCwd);
		rmSync(originDir, { recursive: true, force: true });
		rmSync(localDir, { recursive: true, force: true });
	}
});
