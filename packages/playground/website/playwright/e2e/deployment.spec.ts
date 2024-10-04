/* eslint-disable no-loop-func */
import path from 'path';
import { test, expect } from '../playground-fixtures.ts';
import { startVersionSwitchingServer as startServer } from '../version-switching-server.ts';

const port = 7999;
const url = `http://localhost:${port}`;

const maxDiffPixels = 4000;

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
	test(`When a new website version is deployed, it should be loaded upon a regular page refresh (with HTTP caching ${
		cachingEnabled ? 'enabled' : 'disabled'
	})`, async ({ website, page }) => {
		server!.setHttpCacheEnabled(cachingEnabled);

		await page.goto(url);
		await website.waitForNestedIframes();
		await expect(page).toHaveScreenshot('website-old.png', {
			maxDiffPixels,
		});

		server!.switchToNewVersion();
		await page.goto(url);
		await website.waitForNestedIframes();
		await expect(page).toHaveScreenshot('website-new.png', {
			maxDiffPixels,
		});
	});
}

test(
	'When a new website version is deployed while the old version is still loaded, ' +
		'creating a new site should still work.',
	async ({ website, page, wordpress }) => {
		server!.setHttpCacheEnabled(true);
		server!.switchToMidVersion();

		await page.goto(`${url}/?wp=6.5`);
		await website.waitForNestedIframes();

		// Switching to the new app version does not trigger a page reload,
		// but it deletes all the stale assets from the server.
		server!.switchToNewVersion();

		// The non-reloaded tab should still work. The remote.html iframes
		// that are already loaded should continue to work, and the newly
		// loaded remote.html iframes should pull in the latest Playground version.
		await website.ensureSiteManagerIsOpen();
		await website.openNewSiteModal();

		await website.page
			.locator('select[name="phpVersion"]')
			.selectOption({ label: 'PHP 7.4' });

		await website.page
			.locator('select[name="wpVersion"]')
			.selectOption({ label: 'WordPress 6.5' });

		await website.page
			.locator('select[name="language"]')
			.selectOption({ label: 'Polish' });

		await website.clickCreateInNewSiteModal();
		await website.waitForNestedIframes();

		// @TODO locate by role or title or so
		// Confirm the page was not reloaded in the meantime, as in – we should still
		// have two sites in the sidebar.
		expect(
			website.page.locator(
				'button[title="This is a temporary Playground. Your changes will be lost on page refresh."]'
			)
		).toHaveCount(2);

		// Confirm we're looking at the Polish site.
		await website.ensureSiteManagerIsClosed();
		expect(wordpress.locator('body')).toContainText('Edytuj witrynę');
	}
);

test(
	'When a fresh tab is upgraded to a newly deployed Playground version while another tab is' +
		'still running the old version, both tabs should continue to work.',
	async ({ website, wordpress, page, browser, browserName }) => {
		server!.switchToMidVersion();

		test.skip(
			browserName === 'webkit',
			`Playwright creates separate ephemeral browser contexts for each Safari page, ` +
				`which means they don't actually share the service worker and the first tab won't` +
				`be refreshed when the second tab updates its service worker registration.`
		);
		await page.goto(`${url}/?php=7.4&wp=6.5&lang=pl_PL`);
		await website.waitForNestedIframes();
		expect(wordpress.locator('body')).toContainText('Edit site');

		server!.switchToNewVersion();

		const page2 = await browser.newPage();
		// The "mid" version only ships PHP 7.4 and WP 6.5. By
		// going to a newer version, we can confirm we're using
		// the new version.
		await page2.goto(`${url}/?php=8.2&wp=6.6`);
		await website.waitForNestedIframes(page2);
		// If the WordPress loaded, we know the new version is being used.
		expect(website.wordpress(page2).locator('body')).toContainText(
			'Edit site'
		);

		// Now let's create another site in the first tab and confirm
		// everything still works as expected.
		await website.ensureSiteManagerIsOpen();
		await website.openNewSiteModal();

		// Intentionally choose PHP and WordPress versions that are unavailable
		// in the "mid" version.
		await website.page
			.locator('select[name="phpVersion"]')
			.selectOption({ label: 'PHP 7.3' });

		await website.page
			.locator('select[name="wpVersion"]')
			.selectOption({ label: 'WordPress 6.6' });

		await website.page
			.locator('select[name="language"]')
			.selectOption({ label: 'Polish' });

		await website.clickCreateInNewSiteModal();
		await website.waitForNestedIframes();

		// @TODO locate by role or title or so
		// Confirm the page was not reloaded in the meantime, as in – we should still
		// have two sites in the sidebar.
		expect(
			website.page.locator(
				'button[title="This is a temporary Playground. Your changes will be lost on page refresh."]'
			)
		).toHaveCount(2);

		// Confirm we're looking at the Polish site.
		await website.ensureSiteManagerIsClosed();
		expect(wordpress.locator('body')).toContainText('Edytuj witrynę');
	}
);

test('offline mode – the app should load even when the server goes offline', async ({
	website,
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

	await page.goto(`${url}`);
	await website.waitForNestedIframes();
	// @TODO a better check – screenshot comparisons will be annoying to maintain
	await expect(page).toHaveScreenshot('website-online.png', {
		maxDiffPixels,
	});

	server!.kill();
	await page.reload();
	await website.waitForNestedIframes();
	await expect(page).toHaveScreenshot('website-online.png', {
		maxDiffPixels,
	});
});
