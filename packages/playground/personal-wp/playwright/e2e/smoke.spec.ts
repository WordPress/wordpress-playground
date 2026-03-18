import { test, expect } from '../playground-fixtures';

// On first visit (no OPFS data), the default my-wordpress blueprint runs.
// It installs a welcome plugin and lands on
// /wp-admin/tools.php?page=playground-welcome (an onboarding screen).
// These smoke tests verify that flow completes successfully.

test('should boot WordPress with the default blueprint', async ({
	website,
	wordpress,
}) => {
	await website.goto('./');
	await expect(wordpress.locator('#wpwrap')).toBeVisible();
});

test('should auto-login the user via the default blueprint', async ({
	website,
	wordpress,
}) => {
	await website.goto('./');
	// The default blueprint sets login: true. The admin bar is present
	// in the DOM when logged in, though it may be CSS-hidden initially.
	await expect(wordpress.locator('#wpadminbar')).toBeAttached();
});

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

test('should render the playground viewport iframe', async ({ website }) => {
	await website.goto('./');
	await expect(
		website.page.locator(
			'#playground-viewport:visible,.playground-viewport:visible'
		)
	).toBeVisible();
});
