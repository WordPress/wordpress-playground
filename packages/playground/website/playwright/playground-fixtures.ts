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
		// Define a function to wait for nested iframes
		async function waitForNestedIframes(page: Page) {
			const outerSelector = '#playground-viewport';
			await page.waitForSelector(outerSelector);
			const outerFrame = page.frameLocator(outerSelector);
			await expect(outerFrame.locator('body')).not.toBeEmpty();

			const innerSelector = '#wp';
			await outerFrame.locator(innerSelector).waitFor();
			const innerFrame = outerFrame.frameLocator(innerSelector);
			await expect(innerFrame.locator('body')).not.toBeEmpty();
			return innerFrame;
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
