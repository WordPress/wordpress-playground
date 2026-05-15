/* eslint-disable comment-length/limit-multi-line-comments */
import { test, expect } from '../playground-fixtures';
import type { BrowserContext, Page } from '@playwright/test';
import type { Blueprint } from '@wp-playground/blueprints';
import { resolve } from 'node:path';
import { encodeStringAsBase64 } from '../../src/lib/base64';

// We can't import the WordPress versions directly from the remote package
// because of ESModules vs CommonJS incompatibilities. Let's just import the
// JSON file directly. @ts-ignore
// eslint-disable-next-line @nx/enforce-module-boundaries
import * as MinifiedWordPressVersions from '../../../wordpress-builds/src/wordpress/wp-versions.json';

const LatestSupportedWordPressVersion = Object.keys(
	(MinifiedWordPressVersions as any).default ?? MinifiedWordPressVersions
).filter((x) => !['trunk', 'beta'].includes(x))[0];

test('should load PHP 8.3 by default', async ({ website, wordpress }) => {
	// Navigate to the website
	await website.goto('./?url=/phpinfo.php');
	await expect(wordpress.locator('h1.p').first()).toContainText(
		'PHP Version 8.3'
	);
});

test.describe('option `php-extension`', () => {
	test.skip(
		({ browserName }) => browserName !== 'chromium',
		'External PHP extensions require JSPI support.'
	);

	test('should load an extension from a manifest URL', async ({
		website,
	}) => {
		await routeIntlExtension(website.page.context());

		await gotoPHPOnlyPlayground(website.page, {
			'php-extension': intlManifestUrl,
		});
		await waitForPlaygroundClient(website.page);

		const probe = await website.page.evaluate(async () => {
			const playground = (window as any).playground;
			const response = await playground.run({
				code: `<?php
				echo json_encode([
					'loaded' => extension_loaded('intl'),
					'has_formatter' => class_exists('IntlDateFormatter'),
					'formatted' => (new IntlDateFormatter(
						'pl_PL',
						IntlDateFormatter::FULL,
						IntlDateFormatter::NONE,
						'UTC'
					))->format(0),
				]);`,
			});
			return JSON.parse(response.text);
		});

		expect(probe.loaded).toBe(true);
		expect(probe.has_formatter).toBe(true);
		expect(probe.formatted).toContain('1970');
	});

	test('should load a real extension manifest URL', async ({ website }) => {
		await gotoPHPOnlyPlayground(website.page, {
			'php-extension': sqliteParserManifestUrl,
		});
		await waitForPlaygroundClient(website.page);

		const probe = await website.page.evaluate(async () => {
			const playground = (window as any).playground;
			const response = await playground.run({
				code: `<?php
				$lexer = new WP_MySQL_Native_Lexer(
					'SELECT option_name FROM wp_options WHERE option_id = 1',
					'8.0.0',
					0
				);
				$tokens = 0;
				while ($lexer->next_token()) {
					++$tokens;
				}
				echo json_encode([
					'loaded' => extension_loaded('wp_mysql_parser'),
					'classes' => class_exists('WP_MySQL_Native_Lexer', false)
						&& class_exists('WP_MySQL_Native_Parser', false),
					'tokens' => $tokens,
				]);`,
			});
			return JSON.parse(response.text);
		});

		expect(probe).toEqual({
			loaded: true,
			classes: true,
			tokens: 9,
		});
	});

	test('should reject unsupported manifest URL schemes', async ({
		website,
	}) => {
		await gotoPHPOnlyPlayground(website.page, {
			'php-extension': 'file:///tmp/xdebug/manifest.json',
		});

		await expectSiteBootError(
			website.page,
			'manifest URL must use http: or https:'
		);
	});

	test('should reject malformed extension manifests', async ({ website }) => {
		await website.page
			.context()
			.route(invalidManifestUrl, async (route) => {
				await route.fulfill({ json: { name: 'xdebug' } });
			});

		await gotoPHPOnlyPlayground(website.page, {
			'php-extension': invalidManifestUrl,
		});

		await expectSiteBootError(website.page);
	});

	test('should reject manifests without an artifact for the active PHP version', async ({
		website,
	}) => {
		await website.page
			.context()
			.route(noArtifactManifestUrl, async (route) => {
				await route.fulfill({
					json: {
						name: 'xdebug',
						loadWithIniDirective: 'zend_extension',
						artifacts: [
							{
								phpVersion: '8.4',
								sourcePath: 'xdebug.so',
							},
						],
					},
				});
			});

		await gotoPHPOnlyPlayground(website.page, {
			'php-extension': noArtifactManifestUrl,
		});

		await expectSiteBootError(website.page);
	});
});

test('should load WordPress latest by default', async ({
	website,
	wordpress,
}) => {
	await website.goto('./?url=/wp-admin/');

	const expectedBodyClass =
		'branch-' + LatestSupportedWordPressVersion.replace('.', '-');
	await expect(wordpress.locator(`body.${expectedBodyClass}`)).toContainText(
		'Dashboard'
	);
});

test('should load WordPress 6.3 when requested', async ({
	website,
	wordpress,
}) => {
	await website.goto('./?wp=6.3&url=/wp-admin/');
	await expect(wordpress.locator(`body.branch-6-3`)).toContainText(
		'Dashboard'
	);
});

test('should disable networking when requested', async ({
	website,
	wordpress,
}) => {
	await website.goto('./?networking=no&url=/wp-admin/plugin-install.php');
	await expect(wordpress.locator('.notice.error')).toContainText(
		'Network access is an experimental, opt-in feature'
	);
});

test('should enable networking when requested', async ({
	website,
	wordpress,
}) => {
	await website.goto('./?networking=yes&url=/wp-admin/plugin-install.php');
	await expect(wordpress.locator('body')).toContainText('Install Now');
});

test('should install the specified plugin', async ({ website, wordpress }) => {
	await website.goto('./?plugin=gutenberg&url=/wp-admin/plugins.php');
	await expect(wordpress.locator('#deactivate-gutenberg')).toContainText(
		'Deactivate'
	);
});

test('should login the user in by default if no login query parameter is provided', async ({
	website,
	wordpress,
}) => {
	await website.goto('./?url=/wp-admin/');
	await expect(wordpress.locator('body')).toContainText('Dashboard');
});

test('should login the user in if the login query parameter is set to yes', async ({
	website,
	wordpress,
}) => {
	await website.goto('./?login=yes&url=/wp-admin/');
	await expect(wordpress.locator('body')).toContainText('Dashboard');
});

test('should not login the user in if the login query parameter is set to no', async ({
	website,
	wordpress,
}) => {
	await website.goto('./?login=no&url=/wp-admin/');
	await expect(wordpress.locator('input[type="submit"]')).toContainText(
		'Log In'
	);
});

[
	['/wp-admin/', 'should redirect to wp-admin'],
	['/wp-admin/post.php?post=1&action=edit', 'should redirect to post editor'],
].forEach(([path, description]) => {
	test(description, async ({ website, wordpress }) => {
		await website.goto(`./?url=${encodeURIComponent(path)}`);
		expect(
			await wordpress
				.locator('body')
				.evaluate((body) => body.ownerDocument.location.href)
		).toContain(path);
	});
});

test('should translate WP-admin to Spanish using the language query parameter', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName === 'webkit',
		`It's unclear why this test fails on Safari. The root cause of the failure is unknown as the feature ` +
			`seems to be working in manual testing.`
	);
	await website.goto('./?language=es_ES&url=/wp-admin/');
	await expect(wordpress.locator('body')).toContainText('Escritorio');
});

/**
 * There is no reason to remove encoded control characters from the URL.
 * For example, the html-api-debugger accepts markup with newlines encoded
 * as %0A via the query string.
 */
test('should retain encoded control characters in the URL', async ({
	website,
	wordpress,
	browserName,
}) => {
	// A beautiful URL with encoded non-printable control characters.
	const path =
		'/wp-admin/admin.php?page=html-api-debugger&html=%3Cdiv%3E%0A1%0A2%0A3%0A%3C%2Fdiv%3E';
	const queryApiParams = new URLSearchParams();

	// Keep the landing page as a `url` to make sure we handle percent-encoding correctly.
	// In particular, we don't want to ever double-decode or double-encode the URL.
	queryApiParams.set('url', encodeURIComponent(path));
	queryApiParams.set('plugin', 'html-api-debugger');

	/**
	 * The Blueprint below prevents WordPress from messing up our URL.
	 *
	 * WordPress is trying really hard to make things difficult for us.
	 * It ships the following code in wp-admin <head> to confuse the user
	 * by showing them a different URL in the browser's address bar than
	 * the one they've typed in. This is after PHP processed the original
	 * request carrying the original URL:
	 *
	 *     <link id="wp-admin-canonical" rel="canonical" href="http://127.0.0.1:5400/scope:excited-peaceful-river/wp-admin/admin.php?page=html-api-debugger&#038;html=%3Cdiv%3E123%3C%2Fdiv%3E" />
	 *     <script>
	 *         if ( window.history.replaceState ) {
	 *             window.history.replaceState( null, null, document.getElementById( 'wp-admin-canonical' ).href + window.location.hash );
	 *         }
	 *     </script>
	 *
	 * Not on our watch! This Blueprint disables the history API to make sure
	 * the address bar displays the actual URL we've sent to the server to
	 * generate the page.
	 */
	const blueprint = {
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/wp-content/mu-plugins/0-disable-history.php',
				data: `<?php
					add_action('admin_init', function() {
						echo '<script>
						for(const k in window.history) {
							window.history[k] = null;
						}
						console.log(\\'history disabled\\');
						</script>';
					}, 100000);
				?>`,
			},
		],
	};

	// We need to use the html-api-debugger plugin to test this because
	// most wp-admin pages enforce a redirect to a sanitized (broken)
	// version of the URL.
	await website.goto(
		`./?url=${encodeURIComponent(
			path
		)}&plugin=html-api-debugger#${JSON.stringify(blueprint)}`
	);
	expect(
		await wordpress
			.locator('body')
			.evaluate((body) => body.ownerDocument.location.href)
	).toContain(path);
});

const intlManifestUrl = 'https://extensions.test/intl/manifest.json';
const sqliteParserManifestUrl =
	'https://wordpress.github.io/sqlite-database-integration/' +
	'wp_mysql_parser-wasm-extension/' +
	'b31fc53ea599d1a2211b75f4a3486b39e63ce01f/manifest.json';
const invalidManifestUrl = 'https://extensions.test/invalid/manifest.json';
const noArtifactManifestUrl =
	'https://extensions.test/no-artifact/manifest.json';
const intlSoPath = resolve(
	process.cwd(),
	'packages/php-wasm/web-builds/8-3/jspi/extensions/intl/intl.so'
);
const icuDataPath = resolve(
	process.cwd(),
	'packages/php-wasm/web/src/lib/extensions/intl/shared/icu.dat'
);

async function routeIntlExtension(context: BrowserContext) {
	await context.route(intlManifestUrl, async (route) => {
		await route.fulfill({
			json: {
				name: 'intl',
				env: {
					ICU_DATA: '/internal/shared',
				},
				artifacts: [
					{
						phpVersion: '8.3',
						sourcePath: 'intl.so',
						extraFiles: {
							vfsRoot: '/internal/shared',
							nodes: [
								{
									vfsPath: 'icudt74l.dat',
									sourcePath: 'icu.dat',
								},
							],
						},
					},
				],
			},
		});
	});
	await context.route(
		'https://extensions.test/intl/intl.so',
		async (route) => {
			await route.fulfill({
				path: intlSoPath,
				contentType: 'application/octet-stream',
			});
		}
	);
	await context.route(
		'https://extensions.test/intl/icu.dat',
		async (route) => {
			await route.fulfill({
				path: icuDataPath,
				contentType: 'application/octet-stream',
			});
		}
	);
}

async function gotoPHPOnlyPlayground(
	page: Page,
	queryParams: Record<string, string>
) {
	const query = new URLSearchParams({
		php: '8.3',
		...queryParams,
	});
	const blueprint: Blueprint = {
		preferredVersions: {
			php: '8.3',
			wp: false,
		},
	};
	await page.goto(
		`./?${query}#${encodeStringAsBase64(JSON.stringify(blueprint))}`
	);
}

async function waitForPlaygroundClient(page: Page) {
	await page.waitForFunction(
		() => Boolean((window as any).playground),
		null,
		{
			timeout: 240_000,
		}
	);
}

async function expectSiteBootError(page: Page, technicalDetails?: string) {
	await expect(page.getByText('Playground crashed')).toBeVisible({
		timeout: 240_000,
	});
	if (!technicalDetails) {
		return;
	}
	await page.getByText('Error details').click();
	await expect(page.locator('pre')).toContainText(technicalDetails);
}
