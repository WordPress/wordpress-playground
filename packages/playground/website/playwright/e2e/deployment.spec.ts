/* eslint-disable no-loop-func */
import path from 'path';
import { test, expect } from '../playground-fixtures.ts';
import { startVersionSwitchingServer as startServer } from '../version-switching-server.ts';

// Tests in this file share a server on port 7999, so they must run serially
// to avoid EADDRINUSE errors from multiple tests trying to bind the same port.
test.describe.configure({ mode: 'serial' });

const port = 7999;
const url = new URL(`http://localhost:${port}`);
// Disable login because an old WP build used in this test
// blocks auto-login. This is because it has an admin user
// with an expired email verification window. If we do not
// disable auto-login, the old Playground build encounters
// a boot error.
url.searchParams.set('login', 'no');
// Specify the theme so we can assert against expected default content.
// This theme is also what the reference screenshots are based on.
url.searchParams.set('theme', 'twentytwentyfour');

const maxDiffPixels = 10_000;

let server: Awaited<ReturnType<typeof startServer>> | null = null;

test.beforeEach(async () => {
	server = await startServer({
		port,
		oldVersionDirectory: path.join(
			__dirname,
			'../../../../../dist/packages/playground/wasm-wordpress-net-old'
		),
		midVersionDirectory: path.join(
			__dirname,
			'../../../../../dist/packages/playground/wasm-wordpress-net-mid'
		),
		newVersionDirectory: path.join(
			__dirname,
			'../../../../../dist/packages/playground/wasm-wordpress-net-new'
		),
	});
	server.switchToOldVersion();
	server.setHttpCacheEnabled(true);
});

test.afterEach(async () => {
	if (server) {
		server.kill();
	}
});

for (const cachingEnabled of [true, false]) {
	/**
	 * These tests are failing in CI but not locally, so they are skipped for
	 * now. We are working on fixing this, but in the meantime, let's avoid
	 * living with failures on trunk.
	 *
	 * The PR for fixing this issue is here:
	 * https://github.com/WordPress/wordpress-playground/pull/2065
	 */
	test(`When a new website version is deployed, it should be loaded upon a regular page refresh (with HTTP caching ${
		cachingEnabled ? 'enabled' : 'disabled'
	})`, async ({ website, page, wordpress }) => {
		server!.setHttpCacheEnabled(cachingEnabled);

		await page.goto(url.href);
		await website.waitForNestedIframes();
		await expect(page).toHaveScreenshot('website-old.png', {
			maxDiffPixels,
		});

		server!.switchToNewVersion();
		await page.goto(url.href);
		await website.waitForNestedIframes();
		await expect(
			website.page.getByLabel('Open Site Manager')
		).toBeVisible();
		await expect(wordpress.locator('body')).toContainText(
			'My WordPress Website'
		);
	});
}

test(
	'When a new website version is deployed while the old version is still loaded, ' +
		'creating a new site should still work.',
	async ({ website, page, wordpress }) => {
		server!.setHttpCacheEnabled(true);
		server!.switchToMidVersion();

		// The mid version only bundles WordPress 6.5, so we must
		// request it explicitly — the default WP version in the mid
		// build's JS may not be available.
		const midUrl = new URL(url);
		midUrl.searchParams.set('wp', '6.5');
		await page.goto(midUrl.href);
		await website.waitForNestedIframes();

		// Switching to the new app version does not trigger a page
		// reload, but it removes the old assets from the server.
		server!.switchToNewVersion();

		// Navigate to a new temporary site. This forces the app shell
		// to fetch the new version's remote.html (network-first) and
		// boot a fresh WordPress instance using the new assets.
		await page.goto(url.href);
		await website.waitForNestedIframes();
		await expect(wordpress.locator('body')).toContainText(
			'My WordPress Website'
		);
	}
);

test('offline mode – the app should load even when the server goes offline', async ({
	website,
	wordpress,
	page,
	browserName,
}) => {
	test.skip(
		browserName === 'webkit',
		`Playwright creates ephemeral browser contexts for each test, which causes the ` +
			`test to fail in Safari. Tl;dr Safari only allows OPFS access in regular, non-incognito ` +
			`browser tabs. See https://github.com/microsoft/playwright/issues/18235`
	);
	test.skip(
		browserName === 'firefox',
		`Playground's offline mode doesn't work in Firefox yet. ` +
			`See https://github.com/WordPress/wordpress-playground/issues/1645`
	);

	server!.switchToNewVersion();

	// First page load – the service worker gets installed, the page becomes controlled. Some
	// assets are fetched before the service worker takes over and caches them.
	await page.goto(`${url}`);
	await website.waitForNestedIframes();

	await expect(website.page.getByLabel('Open Site Manager')).toBeVisible();
	await expect(wordpress.locator('body')).toContainText(
		'My WordPress Website'
	);

	// Second page load – handled by the service worker – the fetched assets are getting cached.
	await page.reload();
	await website.waitForNestedIframes();

	// Kill the server.
	server!.kill();

	// From now on, the critical application assets should be cached.
	await page.reload();
	await website.waitForNestedIframes();

	await expect(website.page.getByLabel('Open Site Manager')).toBeVisible();
	await expect(wordpress.locator('body')).toContainText(
		'My WordPress Website'
	);
});
