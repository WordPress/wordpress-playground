import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGitNumstat } from './parse-git-numstat.mjs';

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

test('parses a mix of text and binary lines', () => {
	const stdout = ['5\t1\ta.ts', '-\t-\tb.wasm', '0\t9\tc.md'].join('\n');
	assert.deepEqual(parseGitNumstat(stdout), [
		{ path: 'a.ts', lines: 6 },
		{ path: 'b.wasm', lines: 0 },
		{ path: 'c.md', lines: 9 },
	]);
});

test('ignores blank lines and a trailing newline', () => {
	assert.deepEqual(parseGitNumstat('3\t3\ta.ts\n'), [
		{ path: 'a.ts', lines: 6 },
	]);
});

test('a rename (under --no-renames) parses as two literal-path entries', () => {
	// The runner passes --no-renames, so git reports a cross-directory rename as
	// a delete of the old path + an add of the new one, each with its full path
	// (never the brace-compressed "a/{old => new}/b" form). Each entry then lands
	// under its own package/glob.
	const stdout = [
		'0\t8\tpackages/php-wasm/web/a.ts',
		'8\t0\tpackages/playground/cli/a.ts',
	].join('\n');
	assert.deepEqual(parseGitNumstat(stdout), [
		{ path: 'packages/php-wasm/web/a.ts', lines: 8 },
		{ path: 'packages/playground/cli/a.ts', lines: 8 },
	]);
});

test('empty output yields no entries', () => {
	assert.deepEqual(parseGitNumstat(''), []);
});
