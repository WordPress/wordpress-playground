import { test as base, Page, expect, FrameLocator } from '@playwright/test';

type WordPressFixtures = {
	wordpress: FrameLocator;
	website: Page;
};

export const test = base.extend<WordPressFixtures>({
	wordpress: async ({ page }, use) => {
		const wpPage = page
			.frameLocator('#playground-viewport')
			.frameLocator('#wp');
		await use(wpPage);
	},
	website: async ({ page }, use) => {
		// Wait for WordPress to load
		async function waitForNestedIframes(page: Page) {
			await expect(
				await page
					.frameLocator('#playground-viewport')
					.frameLocator('#wp')
					.locator('body')
			).not.toBeEmpty();
		}

		// Extend the original page.goto method
		const originalGoto = page.goto.bind(page);
		page.goto = async (url: string, options?: any) => {
			const response = await originalGoto(url, options);
			await waitForNestedIframes(page);
			return response;
		};
		await use(page);
	},
});

export { expect, Page } from '@playwright/test';
