import type { FrameLocator } from '@playwright/test';
import { test as base } from '@playwright/test';
import { PersonalWPPage } from './personal-wp-page';

type PersonalWPFixtures = {
	wordpress: FrameLocator;
	website: PersonalWPPage;
};

export const test = base.extend<PersonalWPFixtures>({
	context: async ({ context }, use) => {
		// Intercept only the built-in launch Blueprint; URL override tests still exercise the app.
		await context.route(
			'https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/my-wordpress/blueprint.json',
			(route) =>
				route.fulfill({
					path: process.env.PERSONAL_WP_TEST_BLUEPRINT!,
					contentType: 'application/json',
					headers: { 'access-control-allow-origin': '*' },
				})
		);
		await use(context);
	},
	wordpress: async ({ website }, use) => {
		await use(website.wordpress());
	},
	website: async ({ page }, use) => {
		await use(new PersonalWPPage(page));
	},
});

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';
