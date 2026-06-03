// @vitest-environment jsdom

/**
 * Adversarial tests for the relay URL rewriter.
 *
 * Every case in this file is here because at least one obvious
 * regex-based approach gets it wrong. The point is to keep us honest:
 * if you ever feel tempted to "simplify" url-rewriter.ts back to a
 * `string.replace(/href=["']\/.../, ...)` one-liner, run this file and
 * watch it light up.
 */

import { describe, it, expect } from 'vitest';
import { createRelayUrlRewriter } from './url-rewriter';

const SESSION = 'sess-123';
const HOST = 'playground.example';
const PREFIX = `/relay/${SESSION}/request`;

const rw = createRelayUrlRewriter(SESSION, HOST);

describe('createRelayUrlRewriter — HTML', () => {
	it('rewrites a simple absolute href', () => {
		const out = rw.rewriteHtml('<a href="/wp-admin/foo">x</a>');
		expect(out).toContain(`href="${PREFIX}/wp-admin/foo"`);
	});

	it('does NOT rewrite an anchor-only href', () => {
		const out = rw.rewriteHtml('<a href="#section">x</a>');
		expect(out).toContain('href="#section"');
		expect(out).not.toContain(PREFIX);
	});

	it('does NOT rewrite a protocol-relative URL', () => {
		const out = rw.rewriteHtml('<img src="//cdn.example.com/x.png">');
		expect(out).toContain('src="//cdn.example.com/x.png"');
		expect(out).not.toContain(`${PREFIX}//cdn`);
	});

	it('does NOT rewrite a third-party absolute URL', () => {
		const out = rw.rewriteHtml('<a href="https://other.example/x">x</a>');
		expect(out).toContain('href="https://other.example/x"');
		expect(out).not.toContain(PREFIX);
	});

	it('rewrites a full URL pointing at the original host', () => {
		const out = rw.rewriteHtml(
			`<a href="https://${HOST}/wp-admin/edit.php?post=1">x</a>`
		);
		expect(out).toContain(`href="${PREFIX}/wp-admin/edit.php?post=1"`);
	});

	it('rewrites scoped Playground URLs to unscoped relay paths', () => {
		const out = rw.rewriteHtml(
			'<a href="/scope:default/wp-admin/edit.php">edit</a>'
		);
		expect(out).toContain(`href="${PREFIX}/wp-admin/edit.php"`);
		expect(out).not.toContain(`${PREFIX}/scope:default`);
	});

	it('does NOT rewrite a data: URI in src', () => {
		const out = rw.rewriteHtml(
			'<img src="data:image/png;base64,iVBORw0KGgo=">'
		);
		expect(out).toContain('data:image/png;base64,iVBORw0KGgo=');
		expect(out).not.toContain(`${PREFIX}/data`);
	});

	it('does NOT rewrite javascript:, mailto:, tel: URIs', () => {
		// eslint-disable-next-line no-script-url
		const jsScheme = 'javascript:void(0)';
		const out = rw.rewriteHtml(
			[
				`<a href="${jsScheme}">a</a>`,
				'<a href="mailto:user@example.com">b</a>',
				'<a href="tel:+15551234567">c</a>',
			].join('')
		);
		expect(out).toContain(jsScheme);
		expect(out).toContain('mailto:user@example.com');
		expect(out).toContain('tel:+15551234567');
		expect(out).not.toContain(PREFIX);
	});

	it('does NOT double-rewrite an already-relayed URL', () => {
		const out = rw.rewriteHtml(
			`<img src="${PREFIX}/wp-content/uploads/img.png">`
		);
		expect(out).toContain(`src="${PREFIX}/wp-content/uploads/img.png"`);
		// Crucially, no `/relay/sess-123/request/relay/sess-123/...`.
		expect(out).not.toContain(`${PREFIX}${PREFIX}`);
	});

	/**
	 * The classic regex killer: a `>` inside an attribute value.
	 *
	 *   <a title="1 > 2" href="/path">link</a>
	 *
	 * A naive `<[^>]+>` matcher splits this in the middle of the title
	 * attribute, decides the tag has ended, and then never sees the href.
	 * DOMParser sees one element with two attributes, exactly as the
	 * spec says.
	 */
	it('handles a > character inside a title attribute and still rewrites href', () => {
		const out = rw.rewriteHtml('<a title="1 > 2" href="/maths">link</a>');
		expect(out).toContain(`href="${PREFIX}/maths"`);
		// And the title survives in some form (entity-encoded by the
		// serializer is fine, what matters is we didn't lose the attr).
		expect(out.toLowerCase()).toMatch(/title=/);
	});

	it('rewrites unquoted attribute values', () => {
		const out = rw.rewriteHtml('<img src=/foo.png alt=ok>');
		expect(out).toContain(`${PREFIX}/foo.png`);
	});

	it('rewrites mixed-case attribute names (HREF, SrC, …)', () => {
		const out = rw.rewriteHtml(
			'<A HREF="/upper">x</A><img SrC="/mixed.png">'
		);
		expect(out).toContain(`${PREFIX}/upper`);
		expect(out).toContain(`${PREFIX}/mixed.png`);
	});

	it('handles mixed quote styles in the same tag', () => {
		const out = rw.rewriteHtml(
			`<img src='/quoted.png' alt="say \\"hi\\"">`
		);
		expect(out).toContain(`${PREFIX}/quoted.png`);
	});

	it('handles multi-line attributes', () => {
		const out = rw.rewriteHtml(
			'<a\n  class="long"\n  href="/multi"\n  rel="nofollow"\n>x</a>'
		);
		expect(out).toContain(`${PREFIX}/multi`);
	});

	it('rewrites WordPress AJAX URLs inside <script> bodies', () => {
		const html =
			'<html><body><script>var u = "/wp-admin/admin-ajax.php"; fetch(u);</script></body></html>';
		const out = rw.rewriteHtml(html);
		expect(out).toContain(`"${PREFIX}/wp-admin/admin-ajax.php"`);
	});

	it('rewrites scoped WordPress AJAX URLs inside <script> bodies', () => {
		const html =
			'<html><body><script>var ajaxurl = "/scope:default/wp-admin/admin-ajax.php";</script></body></html>';
		const out = rw.rewriteHtml(html);
		expect(out).toContain(`"${PREFIX}/wp-admin/admin-ajax.php"`);
		expect(out).toContain('window.fetch');
	});

	it('rewrites absolute scoped URLs inside script bodies', () => {
		const html = `<script type="importmap">{"imports":{"@wordpress/interactivity":"https://${HOST}/scope:default/wp-includes/js/dist/script-modules/interactivity/index.min.js?ver=1"}}</script>`;
		const out = rw.rewriteHtml(html);
		expect(out).toContain(
			`"@wordpress/interactivity":"${PREFIX}/wp-includes/js/dist/script-modules/interactivity/index.min.js?ver=1"`
		);
		expect(out).not.toContain('/scope:default/wp-includes');
	});

	it('injects a runtime URL rewriter that is valid JavaScript', () => {
		const html =
			'<html><body><a href="/scope:default/">site</a></body></html>';
		const out = rw.rewriteHtml(html);
		const doc = new DOMParser().parseFromString(out, 'text/html');
		const injectedScript = doc.querySelector('script')?.textContent;
		expect(injectedScript).toContain('window.fetch');
		expect(() => new Function(injectedScript || '')).not.toThrow();
	});

	it('does NOT touch unrelated URLs inside <script> bodies', () => {
		const html =
			'<html><body><script>var u = "/wp-admin/edit.php"; console.log(u);</script></body></html>';
		const out = rw.rewriteHtml(html);
		expect(out).toContain('"/wp-admin/edit.php"');
		expect(out).not.toContain(`${PREFIX}/wp-admin/edit.php`);
	});

	it('does NOT touch URLs inside HTML comments', () => {
		const out = rw.rewriteHtml(
			'<!-- <img src="/should-not-rewrite.png"> --><div></div>'
		);
		expect(out).not.toContain(`${PREFIX}/should-not-rewrite.png`);
	});

	it('preserves HTML entities in URLs', () => {
		// `&amp;` in the source must remain a single `&` after one decode
		// pass, and the rewritten attribute should still be a valid URL.
		const out = rw.rewriteHtml('<a href="/p?x=1&amp;y=2&amp;z=3">x</a>');
		// Either &amp; or & is acceptable in the serialized output as
		// long as a browser would decode it back to the same URL.
		expect(out).toMatch(
			new RegExp(
				`href="${PREFIX.replace(/\//g, '\\/')}/p\\?x=1(?:&amp;|&)y=2(?:&amp;|&)z=3"`
			)
		);
	});

	it('rewrites srcset entries individually and preserves descriptors', () => {
		const out = rw.rewriteHtml(
			'<img srcset="/a.jpg 1x, /b.jpg 2x, https://other.example/c.jpg 3x">'
		);
		expect(out).toContain(`${PREFIX}/a.jpg 1x`);
		expect(out).toContain(`${PREFIX}/b.jpg 2x`);
		// Third-party srcset entry untouched.
		expect(out).toContain('https://other.example/c.jpg 3x');
	});

	it('rewrites srcset with width descriptors and odd whitespace', () => {
		const out = rw.rewriteHtml(
			'<img srcset="  /img-480.jpg 480w ,/img-960.jpg 960w">'
		);
		expect(out).toContain(`${PREFIX}/img-480.jpg`);
		expect(out).toContain(`${PREFIX}/img-960.jpg`);
	});

	it('rewrites url() inside an inline style attribute', () => {
		const out = rw.rewriteHtml(
			`<div style="background: url('/bg.png') no-repeat"></div>`
		);
		expect(out).toContain(`url('${PREFIX}/bg.png')`);
	});

	it('rewrites url() inside a <style> block but leaves identifiers alone', () => {
		const out = rw.rewriteHtml(
			'<style>.x { background: url(/sprite.png); color: red; }</style>'
		);
		expect(out).toContain(`url(${PREFIX}/sprite.png)`);
		expect(out).toContain('color: red');
	});

	it('does NOT rewrite identical URL strings appearing in <script> when an href in the same document does', () => {
		// Same path appears in two contexts. Only the href should change.
		const html =
			'<a href="/wp-admin/edit.php">edit</a>' +
			'<script>console.log("/wp-admin/edit.php")</script>';
		const out = rw.rewriteHtml(html);
		expect(out).toContain(`href="${PREFIX}/wp-admin/edit.php"`);
		expect(out).toContain('"/wp-admin/edit.php"');
		// And exactly one rewrite — the script's literal must remain bare.
		const matches = out.match(
			new RegExp(`${PREFIX}/wp-admin/edit\\.php`, 'g')
		);
		expect(matches?.length).toBe(1);
	});

	it('does not corrupt CDATA-style content inside inline SVG', () => {
		// Modern HTML SVG doesn't actually use CDATA but legacy
		// theme code still emits it. Whatever happens, the URL inside
		// must not get rewritten and the svg block must round-trip.
		const out = rw.rewriteHtml(
			'<svg><script><![CDATA[ var u = "/should-stay" ]]></script></svg>'
		);
		expect(out).not.toContain(`${PREFIX}/should-stay`);
	});

	it('rewrites form action and formaction', () => {
		const out = rw.rewriteHtml(
			'<form action="/wp-login.php"><button formaction="/admin-post.php">Go</button></form>'
		);
		expect(out).toContain(`action="${PREFIX}/wp-login.php"`);
		expect(out).toContain(`formaction="${PREFIX}/admin-post.php"`);
	});

	it('rewrites legacy attributes (background, longdesc, cite, manifest)', () => {
		const out = rw.rewriteHtml(
			[
				'<body background="/legacy.jpg">',
				'<img longdesc="/desc.html">',
				'<blockquote cite="/quote.html"></blockquote>',
				'<html manifest="/app.appcache">',
			].join('')
		);
		expect(out).toContain(`${PREFIX}/legacy.jpg`);
		expect(out).toContain(`${PREFIX}/desc.html`);
		expect(out).toContain(`${PREFIX}/quote.html`);
		expect(out).toContain(`${PREFIX}/app.appcache`);
	});

	it('preserves the doctype declaration', () => {
		const out = rw.rewriteHtml(
			'<!DOCTYPE html><html><body><a href="/x">x</a></body></html>'
		);
		expect(out).toMatch(/^<!DOCTYPE html>/i);
	});
});

describe('createRelayUrlRewriter — CSS', () => {
	it('rewrites a basic url() in a stylesheet', () => {
		const out = rw.rewriteCss('.bg { background: url(/img/bg.png); }');
		expect(out).toContain(`url(${PREFIX}/img/bg.png)`);
	});

	it('does NOT rewrite a data: URI in CSS', () => {
		const out = rw.rewriteCss(
			'.bg { background: url("data:image/svg+xml,..."); }'
		);
		expect(out).toContain('data:image/svg+xml');
		expect(out).not.toContain(`${PREFIX}/data`);
	});

	it('does NOT rewrite an external URL in CSS', () => {
		const out = rw.rewriteCss(
			".f { font-family: 'X'; src: url('https://other.example/font.woff2'); }"
		);
		expect(out).toContain('https://other.example/font.woff2');
		expect(out).not.toContain(PREFIX);
	});

	it('rewrites multiple url() values in the same rule', () => {
		const out = rw.rewriteCss(
			'.x { background: url(/a.png), url(/b.png), url(//cdn/c.png); }'
		);
		expect(out).toContain(`url(${PREFIX}/a.png)`);
		expect(out).toContain(`url(${PREFIX}/b.png)`);
		expect(out).toContain('url(//cdn/c.png)');
	});

	it('does NOT double-rewrite an already-relayed url()', () => {
		const out = rw.rewriteCss(
			`.x { background: url(${PREFIX}/already.png); }`
		);
		expect(out).toContain(`url(${PREFIX}/already.png)`);
		expect(out).not.toContain(`${PREFIX}${PREFIX}`);
	});
});
