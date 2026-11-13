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
import { joinPaths } from '@php-wasm/util';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { staticReleaseOriginCheckPlugin } from '../../../../vite-extensions/vite-static-release';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { validateWordPressStaticDocuments } from '../../../../vite-extensions/static-release-documents.mjs';

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
