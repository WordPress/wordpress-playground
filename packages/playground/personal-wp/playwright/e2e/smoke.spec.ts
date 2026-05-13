import { test, expect } from '../playground-fixtures';
import type { Blueprint } from '@wp-playground/blueprints';

// personal-wp forks several core modules — blueprint URL parsing
// (resolve-blueprint-from-url.ts), the boot sequence
// (boot-site-client.ts), and the URL router (router.ts). Blueprint
// *step execution* is shared via @wp-playground/blueprints, so we
// don't re-test individual step types (writeFile, wp-cli, etc.).
// These smoke tests verify personal-wp's own parsing → boot chain.

test('should land on My Apps on first visit', async ({ website }) => {
	await website.goto('./');
	await expect(website.page).toHaveURL(/\/my-apps\/$/);
});

test('should apply a blueprint passed via URL hash', async ({ website }) => {
	const blueprint: Blueprint = { landingPage: '/sample-page/' };
	await website.goto(`./#${JSON.stringify(blueprint)}`);
	await expect(website.page).toHaveURL(/sample-page/);
});

test('should display the wp-admin Site Tools admin bar item', async ({
	website,
	wordpress,
}) => {
	await website.goto('./wp-admin/');
	await expect(
		website.page.locator('.playground-viewport:visible')
	).toBeVisible();
	await expect(
		website.page.getByRole('button', { name: 'Open Site Tools' })
	).toBeHidden();
	await expect(
		wordpress.getByRole('link', { name: 'Open Site Tools' })
	).toBeVisible();
});

test('should open Site Tools from the wp-admin admin bar item', async ({
	website,
	wordpress,
}) => {
	await website.goto('./wp-admin/');
	await website.ensureSiteToolsIsClosed();

	await wordpress.getByRole('link', { name: 'Open Site Tools' }).click();

	await expect(
		website.page.getByRole('button', { name: 'Close Site Tools' })
	).toBeVisible();
});
