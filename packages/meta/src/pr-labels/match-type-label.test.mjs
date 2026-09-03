import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchTypeLabel } from './match-type-label.mjs';

// Run locally with:
//   node --test "packages/meta/src/pr-labels/**/*.test.mjs"

test('fix: -> Bug', () => {
	assert.equal(matchTypeLabel('fix: crash on boot'), '[Type] Bug');
});

test('feat: and feature: -> Enhancement', () => {
	assert.equal(matchTypeLabel('feat: add step'), '[Type] Enhancement');
	assert.equal(matchTypeLabel('feature: add step'), '[Type] Enhancement');
});

test('scoped prefix is recognized, e.g. fix(cli):', () => {
	assert.equal(matchTypeLabel('fix(cli): handle flag'), '[Type] Bug');
});

test('unscoped breaking-change marker is recognized: fix!:', () => {
	assert.equal(matchTypeLabel('fix!: remove legacy behavior'), '[Type] Bug');
});

test('unscoped breaking-change marker is recognized: feat!:', () => {
	assert.equal(matchTypeLabel('feat!: drop old API'), '[Type] Enhancement');
});

test('scoped breaking-change marker is recognized: feat(scope)!:', () => {
	assert.equal(
		matchTypeLabel('feat(cli)!: remove API'),
		'[Type] Enhancement'
	);
});

test('perf: -> Performance', () => {
	assert.equal(matchTypeLabel('perf: cache modules'), '[Type] Performance');
});

test('docs: -> Documentation', () => {
	assert.equal(matchTypeLabel('docs: update README'), '[Type] Documentation');
});

test('is case-insensitive', () => {
	assert.equal(matchTypeLabel('FIX: something'), '[Type] Bug');
});

test('unmapped prefixes yield null (chore/refactor/test)', () => {
	assert.equal(matchTypeLabel('chore: bump deps'), null);
	assert.equal(matchTypeLabel('refactor: rename'), null);
	assert.equal(matchTypeLabel('test: add coverage'), null);
});

test('no conventional-commit prefix yields null', () => {
	assert.equal(matchTypeLabel('Update the docs page'), null);
});
