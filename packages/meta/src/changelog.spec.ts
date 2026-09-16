/**
 * Run locally with:
 *   bun test packages/meta/src/changelog.spec.ts
 */
import { test, expect } from 'bun:test';
import { escapeMarkdown, getNormalizedTitle } from './changelog';

// PR titles are attacker-controllable (a public author can rename their own
// PR after merge) and are interpolated into CommonMark source. They must be
// escaped so they render as literal text and cannot inject any active markup.

// Removes every valid `\<punctuation>` escape sequence; whatever ASCII
// punctuation is left over was NOT escaped and could still be parsed as active
// Markdown/HTML.
function unescapedPunctuation(escaped: string): string {
	return escaped.replace(/\\[!-/:-@[-`{-~]/g, '');
}

test('escapes both angle brackets, not just the first', () => {
	// Regression for the String.prototype.replace('<', ...) first-occurrence
	// bug that left a second raw tag intact and enabled stored XSS.
	expect(escapeMarkdown('<x> <iframe srcdoc="<script>">')).toBe(
		'\\<x\\> \\<iframe srcdoc\\=\\"\\<script\\>\\"\\>'
	);
});

test('neutralizes an injected Markdown link', () => {
	const escaped = escapeMarkdown('[click](javascript:alert(1))');
	expect(unescapedPunctuation(escaped)).not.toMatch(/[[\]()]/);
});

test('neutralizes an injected Markdown image', () => {
	const escaped = escapeMarkdown('![](https://attacker.example/log)');
	expect(unescapedPunctuation(escaped)).not.toMatch(/[![\]()]/);
});

test('backslash-escapes every ASCII punctuation character', () => {
	const punctuation = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';
	expect(escapeMarkdown(punctuation)).toBe(
		[...punctuation].map((c) => '\\' + c).join('')
	);
});

test('leaves letters, digits, and spaces untouched', () => {
	expect(escapeMarkdown('Add PHP 8.4 support')).toBe('Add PHP 8\\.4 support');
});

test('getNormalizedTitle emits no unescaped tag from a title', () => {
	// End-to-end wiring: the escape must be applied inside the normalization
	// chain the changelog generator actually runs.
	const title = getNormalizedTitle('Fix <a> and <b> handling', {
		labels: [],
		title: 'Fix <a> and <b> handling',
	} as any);
	expect(unescapedPunctuation(title!)).not.toMatch(/[<>]/);
});
