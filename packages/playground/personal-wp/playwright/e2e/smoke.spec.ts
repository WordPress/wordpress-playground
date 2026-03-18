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

test('should apply a blueprint passed via URL hash', async ({
	website,
	wordpress,
}) => {
	const blueprint: Blueprint = {
		landingPage: '/wp-admin/',
		steps: [{ step: 'login' }],
	};
	await website.goto(`./#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText('Dashboard');
});

test('should display the toolbar with address bar', async ({ website }) => {
	await website.goto('./');
	await expect(
		website.page.locator('header[aria-label="Playground toolbar"]')
	).toBeVisible();
});
