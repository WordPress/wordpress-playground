import { test, expect } from '../playground-fixtures.ts';

const url = `http://localhost:7994`;
const maxDiffPixels = 2000;

// Remember to run the server before running the tests:
// python server.py 7994 dist/packages/playground/wasm-wordpress-net-old dist/packages/playground/wasm-wordpress-net-new
for (const cachingEnabled of [true, false]) {
	test(`When a new website version is deployed, it should be loaded upon a regular page refresh (with HTTP caching ${
		cachingEnabled ? 'enabled' : 'disabled'
	})`, async ({ website, page }) => {
		if (cachingEnabled) {
			await page.goto(`${url}/enable-http-cache`);
			await expect(page.locator('body').textContent()).resolves.toBe(
				'HTTP cache enabled'
			);
		} else {
			await page.goto(`${url}/disable-http-cache`);
			await expect(page.locator('body').textContent()).resolves.toBe(
				'HTTP cache disabled'
			);
		}
		await page.goto(url);
		await website.waitForNestedIframes();

		await expect(page).toHaveScreenshot('website-old-chromium-darwin.png', {
			maxDiffPixels,
		});

		await page.goto(`${url}/switch-to-new-version`);
		await page.goto(url);
		await website.waitForNestedIframes();
		await expect(page).toHaveScreenshot('website-new-chromium-darwin.png', {
			maxDiffPixels,
		});
	});
}

// test(
// 	'When a new website version is deployed while the old version is still opened in two browser tabs, ' +
// 		'both tabs should be upgraded to the new app version upon a regular page refresh',
// 	async ({ website, page, browser }) => {
// 		let server: Server | null = null;
// 		try {
// 			server = await startOldWebsiteServer(page);
// 			await page.goto(url);
// 			await website.waitForNestedIframes();
// 			await expect(page).toHaveScreenshot(
// 				'website-old-chromium-darwin.png',
// 				{
// 					maxDiffPixels,
// 				}
// 			);

// 			const page2 = await browser.newPage();
// 			await page2.goto(url);
// 			await website.waitForNestedIframes(page2);
// 			await expect(page2).toHaveScreenshot(
// 				'website-old-chromium-darwin.png',
// 				{
// 					maxDiffPixels,
// 				}
// 			);

// 			await server.kill();

// 			server = await startNewWebsiteServer(page);
// 			await page.reload();
// 			await website.waitForNestedIframes(page);
// 			// @TODO a better check – screenshot comparison will be annoying to maintain
// 			await expect(page).toHaveScreenshot(
// 				'website-new-chromium-darwin.png',
// 				{
// 					maxDiffPixels,
// 				}
// 			);

// 			await website.waitForNestedIframes(page2);
// 			await expect(page2).toHaveScreenshot(
// 				'website-new-chromium-darwin.png',
// 				{
// 					maxDiffPixels,
// 				}
// 			);
// 		} finally {
// 			if (server) {
// 				await server.kill();
// 			}
// 		}
// 	}
// );

// test('offline mode – the app should load even when the server goes offline', async ({
// 	website,
// 	page,
// }) => {
// 	let server: Server | null = null;
// 	try {
// 		server = await startNewWebsiteServer(page);
// 		await page.goto(url);
// 		await website.waitForNestedIframes();
// 		// @TODO a better check – screenshot comparison will be annoying to maintain
// 		await expect(page).toHaveScreenshot(
// 			'website-online-chromium-darwin.png',
// 			{
// 				maxDiffPixels,
// 			}
// 		);

// 		await server.kill();

// 		await page.goto(url);
// 		await website.waitForNestedIframes();
// 		await expect(page).toHaveScreenshot(
// 			'website-online-chromium-darwin.png',
// 			{
// 				maxDiffPixels,
// 			}
// 		);
// 	} finally {
// 		if (server) {
// 			await server.kill();
// 		}
// 	}
// });
