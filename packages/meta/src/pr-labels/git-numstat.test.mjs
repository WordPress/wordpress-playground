import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changedFileStats, parseGitNumstat } from './git-numstat.mjs';

// Run locally with:
//   node --test "packages/meta/src/pr-labels/**/*.test.mjs"

test('sums added + deleted into lines and keeps the path', () => {
	assert.deepEqual(parseGitNumstat('40\t2\tpackages/php-wasm/web/index.ts'), [
		{ path: 'packages/php-wasm/web/index.ts', lines: 42 },
	]);
});

test('binary files ("-" counts) become 0 lines, not NaN', () => {
	// The regression that would defeat the whole PR: a "-" leaking through as
	// NaN zeroes out package ranking on exactly the binary-heavy PRs we fixed.
	const [entry] = parseGitNumstat(
		'-\t-\tpackages/php-wasm/web-builds/php.wasm'
	);
	assert.equal(entry.lines, 0);
	assert.ok(!Number.isNaN(entry.lines));
	assert.equal(entry.path, 'packages/php-wasm/web-builds/php.wasm');
});

test('parses a mix of text and binary records', () => {
	const stdout =
		['5\t1\ta.ts', '-\t-\tb.wasm', '0\t9\tc.md'].join('\x00') + '\x00';
	assert.deepEqual(parseGitNumstat(stdout), [
		{ path: 'a.ts', lines: 6 },
		{ path: 'b.wasm', lines: 0 },
		{ path: 'c.md', lines: 9 },
	]);
});

test('ignores the trailing NUL terminator', () => {
	assert.deepEqual(parseGitNumstat('3\t3\ta.ts\x00'), [
		{ path: 'a.ts', lines: 6 },
	]);
});

test('a rename (under --no-renames) parses as two literal-path entries', () => {
	// The runner passes --no-renames, so git reports a cross-directory rename as
	// a delete of the old path + an add of the new one, each with its full path
	// (never the brace-compressed "a/{old => new}/b" form). Each entry then lands
	// under its own package/glob.
	const stdout =
		[
			'0\t8\tpackages/php-wasm/web/a.ts',
			'8\t0\tpackages/playground/cli/a.ts',
		].join('\x00') + '\x00';
	assert.deepEqual(parseGitNumstat(stdout), [
		{ path: 'packages/php-wasm/web/a.ts', lines: 8 },
		{ path: 'packages/playground/cli/a.ts', lines: 8 },
	]);
});

test('parses -z NUL-delimited records, keeping a literal tab in the path', () => {
	// Real `git diff --numstat -z` output: `added\tdeleted\tpath\0` per record,
	// with the path verbatim (unquoted). Without -z, git quotes a path that
	// contains a tab as "..\t.." and no package prefix / glob would match it.
	const stdout =
		'1\t0\tpackages/php-wasm/web/normal.ts\x00' +
		'2\t3\tpackages/php-wasm/web/tab\tname.ts\x00';
	assert.deepEqual(parseGitNumstat(stdout), [
		{ path: 'packages/php-wasm/web/normal.ts', lines: 1 },
		{ path: 'packages/php-wasm/web/tab\tname.ts', lines: 5 },
	]);
});

test('empty output yields no entries', () => {
	assert.deepEqual(parseGitNumstat(''), []);
});

// This test reproduces the "auto-label goes crazy after updating from trunk"
// bug in a throwaway git repo and pins down the fix.
//
// The bug: the workflow diffed the PR head against the base SHA carried in the
// webhook payload. When a PR is brought up to date with trunk (rebase/merge),
// that payload SHA can be an OLDER trunk commit than the trunk the head now sits
// on. `git diff old-trunk...head` (three-dot = merge-base(old-trunk, head) →
// head) then walks through every trunk commit between old-trunk and the head's
// real base, so unrelated trunk churn (recompiled PHP.wasm, version bumps) shows
// up as if the PR changed it — and gets labeled as such.
//
// The fix: diff against the CURRENT tip of the base branch instead. Because the
// head's trunk content is always an ancestor of that tip, the three-dot
// merge-base lands exactly on the trunk commit the head is built from, and only
// the PR's own files remain.
//
// changedFileStats() is where this lives — it runs the real `git diff ...` — so
// the test asserts on its output directly, contrasting the correct base with the
// stale one to show the stale base is what reintroduces the churn.
test('changedFileStats diffs against the base tip given, so a stale base leaks trunk churn but the current tip does not', () => {
	// changedFileStats() shells out to `git` in process.cwd() (in the workflow it
	// runs inside the checked-out repo). Build a disposable repo and run the test
	// with cwd pointed at it; restore cwd and delete the repo in `finally`.
	const repo = mkdtempSync(join(tmpdir(), 'pr-labels-numstat-'));
	const git = (...args) =>
		execFileSync('git', args, { cwd: repo }).toString().trim();
	// Write a file, commit it, and return the resulting commit SHA.
	const commit = (path, message) => {
		writeFileSync(join(repo, path), `${message}\n`);
		git('add', path);
		git('commit', '--quiet', '-m', message);
		return git('rev-parse', 'HEAD');
	};

	const originalCwd = process.cwd();
	try {
		process.chdir(repo);
		git('init', '--quiet', '-b', 'trunk');
		git('config', 'user.email', 'test@example.com');
		git('config', 'user.name', 'Test');

		// Build this history on trunk:
		//   oldTrunkTip ── currentTrunkTip        (trunk)
		//                        └── head          (the PR, based on currentTrunkTip)
		//
		//   oldTrunkTip      the stale SHA a webhook might report as the base.
		//   currentTrunkTip  a later trunk-only commit — the churn the PR did NOT
		//                    author but which sits between oldTrunkTip and the PR.
		//   head             the PR: one commit adding one file, on currentTrunkTip.
		const oldTrunkTip = commit('base.txt', 'base');
		const currentTrunkTip = commit('trunk-only.wasm', 'trunk-only churn');
		git('checkout', '--quiet', '-b', 'pr', currentTrunkTip);
		const head = commit('pr.ts', 'pr work');

		// Correct base (current trunk tip): the diff contains ONLY the PR's file.
		// This is what the fixed workflow computes and the behavior we want to keep.
		assert.deepEqual(changedFileStats(currentTrunkTip, head), [
			{ path: 'pr.ts', lines: 1 },
		]);

		// Stale base (old trunk tip): the diff wrongly also contains the
		// trunk-only file, because the three-dot merge-base falls back to
		// oldTrunkTip and sweeps in the intervening trunk commit. This is the
		// original bug; the assertion documents that the stale base — not
		// changedFileStats itself — is what produced the spurious files.
		assert.deepEqual(
			changedFileStats(oldTrunkTip, head).map((f) => f.path),
			['pr.ts', 'trunk-only.wasm']
		);
	} finally {
		process.chdir(originalCwd);
		rmSync(repo, { recursive: true, force: true });
	}
});
