import { fileURLToPath, pathToFileURL } from 'node:url';
import type { BrowserContext, FrameLocator } from '@playwright/test';
import { test as base } from '@playwright/test';
import { WebsitePage } from './website-page';

type WordPressFixtures = {
	wordpress: FrameLocator;
	website: WebsitePage;
};

export const test = base.extend<WordPressFixtures>({
	wordpress: async ({ page }, use) => {
		const wpPage = page
			/* There are multiple viewports possible, so we need to select
			   the one that is visible. */
			.frameLocator(
				'#playground-viewport:visible,.playground-viewport:visible'
			)
			.frameLocator('#wp');
		await use(wpPage);
	},
	website: async ({ page }, use) => {
		await use(new WebsitePage(page));
	},
});

export { expect, Page } from '@playwright/test';

/** Serve the built CLI, whether requested directly or through the test download proxy. */
export async function serveBuiltWpCli(context: BrowserContext) {
	const wpCliUrl = 'https://playground.wordpress.net/wp-cli.phar';
	await context.route(
		(url) =>
			url.href === wpCliUrl ||
			url.href === `http://127.0.0.1:5263/cors-proxy.php?${wpCliUrl}`,
		(route) =>
			route.fulfill({
				path: fileURLToPath(
					new URL(
						'../../../../dist/packages/playground/wasm-wordpress-net/wp-cli.phar',
						pathToFileURL(__filename)
					)
				),
				contentType: 'application/octet-stream',
				headers: { 'access-control-allow-origin': '*' },
			})
	);
}
