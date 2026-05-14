import { test, expect } from '../playground-fixtures';

test('should open and close the Site Tools panel', async ({ website }) => {
	await website.goto('./');

	await website.ensureSiteToolsIsOpen();
	await expect(
		website.page.getByRole('heading', { name: 'Site Tools' })
	).toBeVisible();
	await expect(
		website.page.getByRole('button', { name: /Close Site Tools/ })
	).toBeVisible();

	await website.ensureSiteToolsIsClosed();
	await expect(
		website.page.getByRole('button', { name: /Open Site Tools/ })
	).toBeVisible();
});

test('should show app, backup, and troubleshooting tools', async ({
	website,
}) => {
	await website.goto('./');

	await website.ensureSiteToolsIsOpen();

	await expect(
		website.page.getByRole('heading', {
			name: 'Installing apps has moved here:',
		})
	).toBeVisible();
	await expect(
		website.page.getByRole('link', { name: /App Launcher/ })
	).toHaveAttribute('href', /blueprint-url=data%3Aapplication%2Fjson/);
	await expect(
		website.page.getByRole('heading', { name: 'Backup' })
	).toBeVisible();
	await expect(
		website.page.getByRole('heading', { name: 'Troubleshooting' })
	).toBeVisible();

	await website.page.getByRole('button', { name: 'start over' }).click();
	await expect(
		website.page.getByRole('button', { name: 'Delete everything' })
	).toBeVisible();
	await website.page
		.getByRole('button', { name: 'enter recovery mode' })
		.click();
	await expect(
		website.page.getByRole('link', {
			name: 'Install Health Check & Troubleshoot',
		})
	).toBeVisible();
});

test('should close the Site Tools panel with its close button', async ({
	website,
}) => {
	await website.goto('./');

	await website.ensureSiteToolsIsOpen();
	await expect(
		website.page.getByRole('link', { name: /App Launcher/ })
	).toBeVisible();

	await website.page
		.getByRole('button', { name: /Close Site Tools/ })
		.click();
	await expect(
		website.page.getByRole('link', { name: /App Launcher/ })
	).not.toBeVisible();
});

test('should display the page title as "My WordPress"', async ({ website }) => {
	await website.goto('./');
	await expect(website.page).toHaveTitle('My WordPress');
});

test('should navigate within WordPress from Site Tools shortcuts', async ({
	website,
	wordpress,
}) => {
	await website.goto('./');

	await website.ensureSiteToolsIsOpen();
	await website.page.getByRole('button', { name: 'WP Admin' }).click();
	await expect(website.page).toHaveURL(/\/wp-admin\/$/);
	await expect(
		wordpress.getByRole('heading', { name: 'Dashboard', level: 1 })
	).toBeVisible();

	await website.page.getByRole('button', { name: 'Homepage' }).click();
	await expect(website.page).toHaveURL(/\/$/);
	await expect(wordpress.locator('p.wp-block-site-title')).toBeVisible();
});
