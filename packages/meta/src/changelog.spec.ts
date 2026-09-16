/**
 * Run locally with:
 *   bun test packages/meta/src/changelog.spec.ts
 */
import { test, expect } from 'bun:test';
import {
	escapeHtml,
	escapeMarkdown,
	getEntry,
	getFeatureEntry,
	getNormalizedTitle,
} from './changelog';

// PR titles are attacker-controllable (a public author can rename their own PR
// after merge) and are interpolated into the generated CommonMark changelog.
// They are escaped in two independent layers: escapeMarkdown backslash-escapes
// Markdown metacharacters, and escapeHtml entity-encodes `<`, `>`, and `&`.

const issue = (title: string) =>
	({
		title,
		labels: [],
		number: 1,
		html_url: 'https://github.com/WordPress/wordpress-playground/pull/1',
	}) as any;

// Removes the escapes a safe title is allowed to contain — backslash escapes
// and the &amp;/&lt;/&gt; entities. Whatever HTML/Markdown metacharacter is
// left over was NOT escaped and could still be parsed as active markup.
function residualMarkup(escaped: string): string {
	return escaped
		.replace(/\\[!-/:-@[-`{-~]/g, '')
		.replace(/&(amp|lt|gt);/g, '');
}

const HOSTILE_TITLES = [
	'<x> <iframe srcdoc="<script>alert(1)</script>">',
	'<img src=x onerror=alert(1)>',
	'[click](javascript:alert(document.domain))',
	'![](https://attacker.example/log)',
	'**bold** `code` [ref][1] & # heading',
];

test('escapeMarkdown backslash-escapes Markdown metacharacters', () => {
	const escaped = escapeMarkdown('[a](b) ! ` # * _ { } .');
	expect(residualMarkup(escaped)).not.toMatch(/[[\]()!`#*]/);
});

test('escapeMarkdown leaves <, >, and & for escapeHtml', () => {
	// These are entity-encoded by escapeHtml, not backslash-escaped here, so the
	// two layers never double-escape the same character.
	expect(escapeMarkdown('<a> & <b>')).toBe('<a> & <b>');
});

test('escapeHtml entity-encodes <, >, and &, ampersand first', () => {
	expect(escapeHtml('<a> & <b>')).toBe('&lt;a&gt; &amp; &lt;b&gt;');
	// & is encoded before < and >, so a literal "&lt;" in a title is not turned
	// into a live "<".
	expect(escapeHtml('&lt;')).toBe('&amp;lt;');
});

test('a title cannot emit a raw tag, even with a decoy first tag', () => {
	// Regression for the String.prototype.replace('<', ...) first-occurrence bug
	// that left a second raw tag intact and enabled stored XSS.
	const title = getNormalizedTitle('<x> <iframe>', issue('<x> <iframe>'));
	expect(title).not.toContain('<');
	expect(title).not.toContain('>');
});

test('leaves letters, digits, and spaces untouched', () => {
	expect(escapeMarkdown('Add PHP 8.4 support')).toBe('Add PHP 8\\.4 support');
});

test('Changelog can be safely generated from hostile PR titles', () => {
	// Exercise the real entry generators. The only markup in a generated entry
	// must be the trusted "([#N](url))" link the tool appends — nothing the PR
	// title contributed may survive as active HTML or Markdown.
	for (const title of HOSTILE_TITLES) {
		const entries = [
			getEntry(issue(title)),
			getFeatureEntry(issue(title), 'Blueprints'),
		];
		for (const entry of entries) {
			const titlePart = entry!.slice(0, entry!.lastIndexOf(' ([#'));
			expect(titlePart).not.toMatch(/[<>]/);
			expect(residualMarkup(titlePart)).not.toMatch(/[<>&[\]()!`#*]/);
		}
	}
});

test('strips a redundant "Feature: " prefix from a feature entry', () => {
	// The entry is grouped under the feature, so the prefix is redundant.
	// Escaping must not defeat this cleanup by escaping the ":" delimiter.
	const entry = getFeatureEntry(
		issue('Blueprints: Add a step'),
		'Blueprints'
	);
	expect(entry).not.toMatch(/Blueprints/i);
	expect(entry).toContain('Add a step');
});

test('strips a redundant "[Feature - ...]" prefix from a feature entry', () => {
	const entry = getFeatureEntry(
		issue('[Blueprints - Add a step]'),
		'Blueprints'
	);
	expect(entry).not.toMatch(/Blueprints/i);
});

test('feature entry still escapes a hostile title', () => {
	const entry = getFeatureEntry(
		issue('Blueprints: <iframe> <iframe>'),
		'Blueprints'
	);
	expect(entry).not.toMatch(/[<>]/);
});
