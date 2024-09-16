import { test as base, FrameLocator } from '@playwright/test';

type WordPressFixtures = {
	wordpressPage: FrameLocator;
};

export const test = base.extend<WordPressFixtures>({
	wordpressPage: async ({ page }, use) => {
		const wpPage = page
			.frameLocator('#playground-viewport')
			.frameLocator('#wp');
		await use(wpPage);
	},
});

export { expect } from '@playwright/test';
