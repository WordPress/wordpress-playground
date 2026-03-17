import { test, expect } from '../playground-fixtures';

test('should boot WordPress and land on wp-admin dashboard', async ({
	website,
	wordpress,
}) => {
	await website.goto('./');
	await expect(wordpress.locator('body')).toContainText('Dashboard');
});

test('should auto-login the user', async ({ website, wordpress }) => {
	await website.goto('./');
	await expect(wordpress.locator('body')).toContainText('Howdy');
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
