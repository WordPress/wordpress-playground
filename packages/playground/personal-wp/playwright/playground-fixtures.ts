import type { FrameLocator } from '@playwright/test';
import { test as base } from '@playwright/test';
import { PersonalWPPage } from './personal-wp-page';

type PersonalWPFixtures = {
	wordpress: FrameLocator;
	website: PersonalWPPage;
};

export const test = base.extend<PersonalWPFixtures>({
	wordpress: async ({ page }, use) => {
		const wpPage = page
			.frameLocator(
				'#playground-viewport:visible,.playground-viewport:visible'
			)
			.frameLocator('#wp');
		await use(wpPage);
	},
	website: async ({ page }, use) => {
		await use(new PersonalWPPage(page));
	},
});

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';
