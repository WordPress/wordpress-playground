import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchPathLabels } from './match-path-labels.mjs';

// Run locally with:
//   node --test "packages/meta/src/pr-labels/**/*.test.mjs"

const anyGlob = (globs) => [
	{ 'changed-files': [{ 'any-glob-to-any-file': globs }] },
];

const config = {
	'[Aspect] Browser': anyGlob(['packages/php-wasm/web/**']),
	'[Type] Documentation': anyGlob(['packages/docs/**', '**/*.md']),
	'[Aspect] Service Worker': anyGlob(['**/service-worker*.{ts,js}']),
	'[Aspect] Sqlite': anyGlob(['**/sqlite*/**']),
};

test('matches a directory prefix glob', () => {
	assert.deepEqual(matchPathLabels(['packages/php-wasm/web/x.ts'], config), [
		'[Aspect] Browser',
	]);
});

test('matches a suffix glob (**/*.md)', () => {
	assert.deepEqual(matchPathLabels(['README.md'], config), [
		'[Type] Documentation',
	]);
});

test('matches a brace-expansion glob ({ts,js})', () => {
	assert.deepEqual(matchPathLabels(['a/b/service-worker.js'], config), [
		'[Aspect] Service Worker',
	]);
});

test('matches a mid-path wildcard glob (**/sqlite*/**)', () => {
	assert.deepEqual(
		matchPathLabels(['packages/x/sqlite-integration/y.php'], config),
		['[Aspect] Sqlite']
	);
});

test('applies every matching label and ignores non-matching files', () => {
	const labels = matchPathLabels(
		['packages/php-wasm/web/x.ts', 'docs/guide.md', 'unrelated/file.txt'],
		config
	);
	assert.deepEqual(labels.sort(), [
		'[Aspect] Browser',
		'[Type] Documentation',
	]);
});

test('returns [] when nothing matches', () => {
	assert.deepEqual(matchPathLabels(['unrelated/file.txt'], config), []);
});

test('includes dotfiles (dot: true, matching actions/labeler default)', () => {
	assert.deepEqual(
		matchPathLabels(['packages/docs/.eslintrc'], {
			'[Type] Documentation': anyGlob(['packages/docs/**']),
		}),
		['[Type] Documentation']
	);
});

test('tolerates a null/empty config', () => {
	assert.deepEqual(matchPathLabels(['a'], null), []);
	assert.deepEqual(matchPathLabels(['a'], {}), []);
});

// Fail-loud guard: any config shape beyond `any-glob-to-any-file` must throw
// rather than silently mislabel.
test('throws on an unsupported match type', () => {
	assert.throws(
		() =>
			matchPathLabels(['a/x'], {
				X: [
					{
						'changed-files': [
							{ 'all-globs-to-any-file': ['a/**'] },
						],
					},
				],
			}),
		/only `any-glob-to-any-file` is supported/
	);
});

test('throws on a non-changed-files rule (e.g. base-branch)', () => {
	assert.throws(
		() => matchPathLabels([], { X: [{ 'base-branch': ['main'] }] }),
		/only `changed-files` is supported/
	);
});

test('throws when a label has more than one entry (AND semantics unsupported)', () => {
	assert.throws(
		() =>
			matchPathLabels([], {
				X: [...anyGlob(['a/**']), ...anyGlob(['b/**'])],
			}),
		/exactly one `changed-files` entry/
	);
});
