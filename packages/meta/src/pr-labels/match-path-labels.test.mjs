import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchPathLabels } from './match-path-labels.mjs';

// Run locally with:
//   node --test "packages/meta/src/pr-labels/**/*.test.mjs"

const rules = {
	'[Aspect] Browser': ['packages/php-wasm/web/**'],
	'[Type] Documentation': ['packages/docs/**', '**/*.md'],
	'[Aspect] Service Worker': ['**/service-worker*.{ts,js}'],
	'[Aspect] Sqlite': ['**/sqlite*/**'],
};

test('matches a directory prefix glob', () => {
	assert.deepEqual(matchPathLabels(['packages/php-wasm/web/x.ts'], rules), [
		'[Aspect] Browser',
	]);
});

test('matches a suffix glob (**/*.md)', () => {
	assert.deepEqual(matchPathLabels(['README.md'], rules), [
		'[Type] Documentation',
	]);
});

test('matches a brace-expansion glob ({ts,js})', () => {
	assert.deepEqual(matchPathLabels(['a/b/service-worker.js'], rules), [
		'[Aspect] Service Worker',
	]);
});

test('matches a mid-path wildcard glob (**/sqlite*/**)', () => {
	assert.deepEqual(
		matchPathLabels(['packages/x/sqlite-integration/y.php'], rules),
		['[Aspect] Sqlite']
	);
});

test('applies every matching label and ignores non-matching files', () => {
	const labels = matchPathLabels(
		['packages/php-wasm/web/x.ts', 'docs/guide.md', 'unrelated/file.txt'],
		rules
	);
	assert.deepEqual(labels.sort(), [
		'[Aspect] Browser',
		'[Type] Documentation',
	]);
});

test('returns [] when nothing matches', () => {
	assert.deepEqual(matchPathLabels(['unrelated/file.txt'], rules), []);
});

test('includes dotfiles (dot: true, matching actions/labeler default)', () => {
	assert.deepEqual(
		matchPathLabels(['packages/docs/.eslintrc'], {
			'[Type] Documentation': ['packages/docs/**'],
		}),
		['[Type] Documentation']
	);
});
