/* eslint-disable comment-length/limit-multi-line-comments */
import { joinPaths } from '@php-wasm/util';
import { test, expect, type Page } from '../playground-fixtures';

// We can't import the WordPress versions directly from the remote package
// because of ESModules vs CommonJS incompatibilities. Let's just import the
// JSON file directly. @ts-ignore
// eslint-disable-next-line @nx/enforce-module-boundaries
import * as MinifiedWordPressVersions from '../../../wordpress-builds/src/wordpress/wp-versions.json';

const LatestSupportedWordPressVersion = Object.keys(
	(MinifiedWordPressVersions as any).default ?? MinifiedWordPressVersions
).filter((x) => !['trunk', 'beta'].includes(x))[0];

const fileBrowserTestDir = 'wp-content/plugins/filebrowser-query-test';
const fileBrowserTestPath = joinPaths(fileBrowserTestDir, 'index.php');
const fileBrowserTestAbsoluteDir = joinPaths('/wordpress', fileBrowserTestDir);
const fileBrowserTestAbsolutePath = joinPaths(
	'/wordpress',
	fileBrowserTestPath
);
const fileBrowserTestContent = `<?php
echo 'filebrowser query api';
echo 'before requested line';
echo 'filebrowser active line';
echo 'after requested line';
`;

function getFileBrowserBlueprintHash(data = fileBrowserTestContent) {
	return encodeURIComponent(
		JSON.stringify({
			steps: [
				{
					step: 'mkdir',
					path: fileBrowserTestAbsoluteDir,
				},
				{
					step: 'writeFile',
					path: fileBrowserTestAbsolutePath,
					data,
				},
			],
		})
	);
}

function getFileBrowserQueryUrl(value: string, blueprintHash?: string) {
	const query = new URLSearchParams();
	query.set('filebrowser', value);
	return `./?${query.toString()}${blueprintHash ? `#${blueprintHash}` : ''}`;
}

test('should load PHP 8.3 by default', async ({ website, wordpress }) => {
	// Navigate to the website
	await website.goto('./?url=/phpinfo.php');
	await expect(wordpress.locator('h1.p').first()).toContainText(
		'PHP Version 8.3'
	);
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

test('should open the File Browser tab when requested', async ({ website }) => {
	await website.goto('./?filebrowser');

	await expect(
		website.page.locator('section[class*="site-info-panel"]')
	).toBeVisible();
	await expect(
		website.page.getByRole('tab', { name: /File browser/i })
	).toHaveAttribute('aria-selected', 'true');
});

test('should open a file from the filebrowser query parameter', async ({
	website,
}) => {
	await website.goto(
		getFileBrowserQueryUrl(
			fileBrowserTestPath,
			getFileBrowserBlueprintHash()
		)
	);

	await expect(
		website.page.locator('[class*="file-browser"] .cm-editor')
	).toBeVisible();
	await expect(
		website.page.locator('[class*="file-browser"] .cm-content')
	).toContainText('filebrowser query api');
	await expect(
		website.page
			.locator('[class*="editorPath"]')
			.filter({ hasText: fileBrowserTestAbsolutePath })
	).toBeVisible();
});

test('should activate the requested filebrowser line', async ({ website }) => {
	await website.goto(
		getFileBrowserQueryUrl(
			`${fileBrowserTestPath}:4`,
			getFileBrowserBlueprintHash()
		)
	);

	await expect
		.poll(async () => getCodeMirrorSelectionLineText(website.page))
		.toContain('filebrowser active line');
});

test('should show a notice for a missing filebrowser target', async ({
	website,
	wordpress,
}) => {
	await website.goto(
		getFileBrowserQueryUrl(
			'wp-content/plugins/filebrowser-query-test/missing.php'
		)
	);

	await expect(
		website.page.getByRole('tab', { name: /File browser/i })
	).toHaveAttribute('aria-selected', 'true');
	await expect(
		website.page
			.locator('.components-notice__content')
			.filter({ hasText: /Could not open .*missing\.php/ })
	).toBeVisible();
	await expect(wordpress.locator('body')).not.toBeEmpty();
});

async function getCodeMirrorSelectionLineText(page: Page) {
	return page
		.locator('[class*="file-browser"] .cm-content')
		.evaluate((content) => {
			const selection = content.ownerDocument.getSelection();
			if (
				!selection?.anchorNode ||
				!content.contains(selection.anchorNode)
			) {
				return '';
			}

			let current: Node | null = selection.anchorNode;
			while (current && current !== content) {
				if (
					current instanceof HTMLElement &&
					current.classList.contains('cm-line')
				) {
					return current.textContent ?? '';
				}
				current = current.parentNode;
			}
			return '';
		});
}

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
