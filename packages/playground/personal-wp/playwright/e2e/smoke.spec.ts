import { test, expect } from '../playground-fixtures';
import type { Blueprint } from '@wp-playground/blueprints';

// These smoke tests cover Personal WP's own launch URL and boot behavior.

test('should land on My Apps on first visit', async ({ website }) => {
	await website.goto('./');
	await expect(website.page).toHaveURL(/\/my-apps\/$/);
});

test('should ignore a blueprint passed via URL hash', async ({ website }) => {
	const blueprint: Blueprint = { landingPage: '/sample-page/' };
	await website.goto(`./#${JSON.stringify(blueprint)}`);
	await expect(website.page).toHaveURL(/\/my-apps\/$/);
});

test('should ignore a blueprint passed via URL parameter', async ({
	website,
}) => {
	const blueprint: Blueprint = { landingPage: '/sample-page/' };
	const blueprintUrl = `data:application/json,${encodeURIComponent(JSON.stringify(blueprint))}`;
	await website.goto(`./?blueprint-url=${encodeURIComponent(blueprintUrl)}`);
	await expect(website.page).toHaveURL(/\/my-apps\/$/);
});

test('should display the seamless viewport and Site Tools latch', async ({
	website,
}) => {
	await website.goto('./');
	await expect(
		website.page.locator('.playground-viewport:visible')
	).toBeVisible();
	await expect(
		website.page.getByRole('button', { name: /Open Site Tools/ })
	).toBeVisible();
});
