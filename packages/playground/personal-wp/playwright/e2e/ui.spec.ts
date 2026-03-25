import { test, expect } from '../playground-fixtures';

test('should open and close the Site Tools panel', async ({ website }) => {
	await website.goto('./');

	await website.ensureSiteToolsIsOpen();
	await expect(
		website.page.getByRole('button', { name: /Close Site Tools/ })
	).toBeVisible();

	await website.ensureSiteToolsIsClosed();
	await expect(
		website.page.getByRole('button', { name: /Open Site Tools/ })
	).toBeVisible();
});

test('should open the menu overlay', async ({ website }) => {
	await website.goto('./');

	await website.openMenuOverlay();

	await expect(website.page.getByText('Install Apps')).toBeVisible();
	await expect(
		website.page.getByRole('heading', { name: 'Backup' })
	).toBeVisible();
	await expect(
		website.page.getByRole('heading', { name: 'Start over' })
	).toBeVisible();
	await expect(
		website.page.getByRole('heading', { name: 'Recovery' })
	).toBeVisible();

	await website.page
		.getByRole('button', { name: 'you can reset this WordPress' })
		.click();
	await expect(
		website.page.getByRole('button', { name: 'Delete everything' })
	).toBeVisible();
	await website.page
		.getByRole('button', { name: 'you can troubleshoot' })
		.click();
	await expect(
		website.page.getByRole('link', {
			name: 'Install Health Check & Troubleshoot',
		})
	).toBeVisible();
});

test('should close the menu overlay with Escape', async ({ website }) => {
	await website.goto('./');

	await website.openMenuOverlay();
	await expect(website.page.getByText('Install Apps')).toBeVisible();

	await website.page.keyboard.press('Escape');
	await expect(website.page.getByText('Install Apps')).not.toBeVisible();
});

test('should display the page title as "My WordPress"', async ({ website }) => {
	await website.goto('./');
	await expect(website.page).toHaveTitle('My WordPress');
});

test('should navigate within WordPress when address bar URL changes', async ({
	website,
	wordpress,
}) => {
	await website.goto('./');

	const addressBar = website.addressBar();
	await addressBar.click();
	await addressBar.fill('/wp-admin/edit.php');
	await addressBar.press('Enter');

	await expect(wordpress.locator('h1.wp-heading-inline')).toHaveText('Posts');
});
