import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankPackageLabels } from './rank-package-labels.mjs';

// Run locally with:
//   node --test "packages/meta/src/pr-labels/**/*.test.mjs"

const RULES = [
	['packages/php-wasm/web-service-worker/', '[Package][@php-wasm] Web SW'],
	['packages/php-wasm/web/', '[Package][@php-wasm] Web'],
	['packages/playground/cli/', '[Package][@wp-playground] CLI'],
];

test('ranks by lines changed, most first', () => {
	const stats = [
		{ path: 'packages/php-wasm/web/a.ts', lines: 5 },
		{ path: 'packages/playground/cli/b.ts', lines: 50 },
	];
	assert.deepEqual(rankPackageLabels(stats, RULES), [
		'[Package][@wp-playground] CLI',
		'[Package][@php-wasm] Web',
	]);
});

test('caps the result at `max` (default 3)', () => {
	const stats = [
		{ path: 'packages/php-wasm/web/a.ts', lines: 1 },
		{ path: 'packages/playground/cli/b.ts', lines: 1 },
		{ path: 'packages/php-wasm/web-service-worker/c.ts', lines: 1 },
	];
	assert.equal(rankPackageLabels(stats, RULES, 2).length, 2);
});

test('first matching prefix wins (order matters)', () => {
	// A web-service-worker path must NOT be counted under the shorter web prefix.
	const stats = [
		{ path: 'packages/php-wasm/web-service-worker/sw.ts', lines: 9 },
	];
	assert.deepEqual(rankPackageLabels(stats, RULES), [
		'[Package][@php-wasm] Web SW',
	]);
});

test('sums lines and files across a package', () => {
	const stats = [
		{ path: 'packages/php-wasm/web/a.ts', lines: 2 },
		{ path: 'packages/php-wasm/web/b.ts', lines: 3 },
	];
	assert.deepEqual(rankPackageLabels(stats, RULES), [
		'[Package][@php-wasm] Web',
	]);
});

test('breaks line ties by file count', () => {
	const stats = [
		// CLI: 10 lines across 1 file. Web: 10 lines across 2 files -> Web wins.
		{ path: 'packages/playground/cli/a.ts', lines: 10 },
		{ path: 'packages/php-wasm/web/a.ts', lines: 5 },
		{ path: 'packages/php-wasm/web/b.ts', lines: 5 },
	];
	assert.deepEqual(rankPackageLabels(stats, RULES), [
		'[Package][@php-wasm] Web',
		'[Package][@wp-playground] CLI',
	]);
});

test('ignores files under no known package', () => {
	assert.deepEqual(
		rankPackageLabels([{ path: 'README.md', lines: 99 }], RULES),
		[]
	);
});

test('binary-only change (0 lines) still ranks by file count', () => {
	// Recompiled WASM: numstat reports 0 lines, but the package should still
	// be labeled rather than dropped.
	const stats = [{ path: 'packages/php-wasm/web/php.wasm', lines: 0 }];
	assert.deepEqual(rankPackageLabels(stats, RULES), [
		'[Package][@php-wasm] Web',
	]);
});
