import { test, expect } from '../playground-fixtures';

// On first visit (no OPFS data), the default my-wordpress blueprint runs.
// It installs a welcome plugin and lands on
// /wp-admin/tools.php?page=playground-welcome (an onboarding screen).
// Core playground-website tests cover WordPress boot, login, blueprint
// execution, and iframe rendering. These smoke tests only verify the
// personal-wp-specific default blueprint flow.

test('should land on the welcome page on first visit', async ({ website }) => {
	await website.goto('./');
	await expect(website.addressBar()).toHaveValue(
		/\/wp-admin\/tools\.php\?page=playground-welcome/
	);
});

test('should display the toolbar with address bar', async ({ website }) => {
	await website.goto('./');
	await expect(
		website.page.locator('header[aria-label="Playground toolbar"]')
	).toBeVisible();
});
