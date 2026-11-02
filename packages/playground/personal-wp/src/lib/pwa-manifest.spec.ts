import { readFileSync } from 'node:fs';
import { joinPaths } from '@php-wasm/util';

const appRoot = joinPaths(process.cwd(), 'packages/playground/personal-wp');

describe('PWA manifest configuration', () => {
	it('includes install metadata, screenshots, and maskable icons', () => {
		const manifest = readJson('public/manifest.json');

		expect(manifest).toMatchObject({
			id: '/',
			display: 'standalone',
			display_override: ['standalone'],
			scope: '/',
			start_url: '/',
			categories: ['productivity', 'utilities'],
		});
		expect(manifest.screenshots).toEqual([
			expect.objectContaining({
				src: 'ogimage-mywp.png',
				sizes: '1200x600',
				form_factor: 'wide',
			}),
		]);
		expect(manifest).not.toHaveProperty('shortcuts');
		expect(manifest.icons).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					src: 'maskable-icon-512.png',
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
			/<meta\b(?=[^>]*\bname="apple-mobile-web-app-title")(?=[^>]*\bcontent="My WordPress")[^>]*>/
		);
		expect(html).toContain('/dynamic-manifest.json.php');
		expect(html).toContain(
			"import { isDevServer } from '../remote/src/lib/dev-server';"
		);
		expect(html).toContain(
			'if (!isDevServer(new URL(window.location.href)))'
		);
		expect(html).not.toContain('runningOnDevServer');
		expect(html).not.toContain('if (!manifestUrl)');
	});

	it('keeps dynamic manifest identity stable across cache-busting URLs', () => {
		const php = readText('public/dynamic-manifest.json.php');

		expect(php).toContain('function getManifestId($start_url)');
		expect(php).toContain("unset($query['random']);");
		expect(php).toContain('"id" => getManifestId($start_url)');
		expect(php).toContain('"scope" => $base_url . "/"');
		expect(php).toContain("$_SERVER['HTTP_HOST']");
		expect(php).not.toContain('getTrustedBaseUrl');
		expect(php).toContain(" : '/'");
		expect(php).not.toContain('"shortcuts" =>');
		expect(php).toContain(
			"$app_name = $_GET['app_name'] ?? 'My WordPress';"
		);
	});
});

function readJson(relativePath: string) {
	return JSON.parse(readText(relativePath));
}

function readText(relativePath: string) {
	return readFileSync(joinPaths(appRoot, relativePath), 'utf8');
}
