import { test as base, FrameLocator } from '@playwright/test';
import { WebsitePage } from './website-page';

type WordPressFixtures = {
	wordpress: FrameLocator;
	website: WebsitePage;
};

export const test = base.extend<WordPressFixtures>({
	wordpress: async ({ page }, use) => {
		const wpPage = page
			.frameLocator('#playground-viewport')
			.frameLocator('#wp');
		await use(wpPage);
	},
	website: async ({ page }, use) => {
		await use(new WebsitePage(page));
	},
});

export { expect, Page } from '@playwright/test';
