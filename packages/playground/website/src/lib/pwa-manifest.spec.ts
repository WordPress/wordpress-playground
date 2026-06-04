import { readFileSync } from 'node:fs';
import { joinPaths } from '@php-wasm/util';

const appRoot = joinPaths(process.cwd(), 'packages/playground/website');

describe('PWA manifest configuration', () => {
	it('includes install metadata, shortcuts, screenshots, and maskable icons', () => {
		const manifest = readJson('public/manifest.json');

		expect(manifest).toMatchObject({
			id: '/',
			display: 'standalone',
			display_override: ['standalone'],
			scope: '/',
			start_url: '/',
			categories: ['development', 'education', 'utilities'],
		});
		expect(manifest.screenshots).toEqual([
			expect.objectContaining({
				src: '/ogimage.png',
				sizes: '1200x600',
				form_factor: 'wide',
			}),
		]);
		expect(
			manifest.shortcuts.map(({ url }: { url: string }) => url)
		).toEqual([
			'/?url=/',
			'/?url=/wp-admin/',
			'/?url=/wp-admin/site-editor.php',
			'/?url=/wp-admin/post-new.php',
			'/?url=/wp-admin/plugins.php',
			'/?url=/wp-admin/themes.php',
		]);
		expect(manifest.icons).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					src: '/maskable-icon-512.png',
					sizes: '512x512',
					purpose: 'maskable',
				}),
			])
		);
	});

	it('adds iOS install metadata and links the production dynamic manifest', () => {
		const html = readText('index.html');

		expect(html).toMatch(
			/<link\b(?=[^>]*\brel="apple-touch-icon")(?=[^>]*\bhref="\/apple-touch-icon\.png")[^>]*>/
		);
		expect(html).toMatch(
			/<meta\b(?=[^>]*\bname="apple-mobile-web-app-capable")(?=[^>]*\bcontent="yes")[^>]*>/
		);
		expect(html).toMatch(
			/<meta\b(?=[^>]*\bname="apple-mobile-web-app-title")(?=[^>]*\bcontent="WordPress Playground")[^>]*>/
		);
		expect(html).toContain('/dynamic-manifest.json.php');
		expect(html).not.toContain('if (!manifestUrl)');
	});

	it('keeps dynamic manifest identity stable across cache-busting URLs', () => {
		const php = readText('public/dynamic-manifest.json.php');

		expect(php).toContain('function getManifestId($start_url)');
		expect(php).toContain("unset($query['random']);");
		expect(php).toContain('"id" => getManifestId($start_url)');
		expect(php).toContain('"scope" => $base_url . "/"');
		expect(php).toContain('function getRequestBaseUrl($fallback_host)');
		expect(php).toContain(
			"$http_host = $_SERVER['HTTP_HOST'] ?? $fallback_host;"
		);
		expect(php).toContain(
			"$base_url = getRequestBaseUrl('playground.wordpress.net');"
		);
		expect(php).not.toContain('allowed_hosts');
		expect(php).toContain(
			'function getShortcutUrl($base_url, $wordpress_url)'
		);
		expect(php).toContain(
			'getShortcutUrl($base_url, "/wp-admin/themes.php")'
		);
	});
});

function readJson(relativePath: string) {
	return JSON.parse(readText(relativePath));
}

function readText(relativePath: string) {
	return readFileSync(joinPaths(appRoot, relativePath), 'utf8');
}
