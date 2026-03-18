import { test, expect } from '../playground-fixtures';
import type { Blueprint } from '@wp-playground/blueprints';

// personal-wp forks several core modules — blueprint URL parsing
// (resolve-blueprint-from-url.ts), the boot sequence
// (boot-site-client.ts), and the URL router (router.ts). Blueprint
// *step execution* is shared via @wp-playground/blueprints, so we
// don't re-test individual step types (writeFile, wp-cli, etc.).
// These smoke tests verify personal-wp's own parsing → boot chain.

test('should land on the welcome page on first visit', async ({ website }) => {
	await website.goto('./');
	await expect(website.addressBar()).toHaveValue(
		/\/wp-admin\/tools\.php\?page=playground-welcome/
	);
});

test('should complete welcome flow and update site title', async ({
	website,
	wordpress,
}) => {
	await website.goto('./');
	await expect(website.addressBar()).toHaveValue(
		/\/wp-admin\/tools\.php\?page=playground-welcome/
	);

	const nameInput = wordpress.locator('#display_name');
	await nameInput.fill('John Doe');
	await nameInput.press('Enter');

	await expect(website.addressBar()).toHaveValue(/\/$/);
	await expect(wordpress.locator('p.wp-block-site-title')).toHaveText(
		"John Doe's WordPress"
	);
});

test('should apply a blueprint passed via URL hash', async ({ website }) => {
	const blueprint: Blueprint = { landingPage: '/sample-page/' };
	await website.goto(`./#${JSON.stringify(blueprint)}`);
	await expect(website.addressBar()).toHaveValue(/sample-page/);
});

test('should display the toolbar with address bar', async ({ website }) => {
	await website.goto('./');
	await expect(
		website.page.locator('header[aria-label="Playground toolbar"]')
	).toBeVisible();
});
