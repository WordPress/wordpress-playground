import { test, expect } from './playground-fixtures';

test('should reflect the URL update from the navigation bar in the WordPress site', async ({
	page,
	wordpressPage,
}) => {
	await page.goto('./?url=/wp-admin');

	const openSiteButton = page.locator('div[title="Open site"]');
	await expect(openSiteButton).toBeVisible();
	await openSiteButton.click();

	const inputElement = page.locator('input[value="/wp-admin/"]');
	await expect(inputElement).toBeVisible();
	await expect(inputElement).toHaveValue('/wp-admin/');
});
