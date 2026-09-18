import type { FrameLocator } from '@playwright/test';
import { test as base } from '@playwright/test';
import { PersonalWPPage } from './personal-wp-page';

type PersonalWPFixtures = {
	wordpress: FrameLocator;
	website: PersonalWPPage;
};

export const test = base.extend<PersonalWPFixtures>({
	wordpress: async ({ website }, use) => {
		await use(website.wordpress());
	},
	website: async ({ page }, use) => {
		await use(new PersonalWPPage(page));
	},
});

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';
