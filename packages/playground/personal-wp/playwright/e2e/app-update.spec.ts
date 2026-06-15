import { test, expect } from '../playground-fixtures';
import type { Page } from '../playground-fixtures';

type VersionRouteState = {
	deployedVersion?: string;
};

test('blocks site boot when a newer app version is deployed', async ({
	page,
}) => {
	await mockAppVersionEndpoint(page, {
		deployedVersion: 'newer-build',
	});

	await page.goto('./');

	await expect(
		page.getByRole('heading', { name: 'Update My WordPress' })
	).toBeVisible();
	await expect(page.locator('#playground-viewport')).not.toBeVisible();
});

test('shows a dismissible update notice after the app is already running', async ({
	website,
	page,
}) => {
	const versionRouteState: VersionRouteState = {};
	await mockAppVersionEndpoint(page, versionRouteState);

	await website.goto('./');
	versionRouteState.deployedVersion = 'newer-build';
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));

	await expect(page.getByRole('status')).toContainText('Update available');
	await page.getByRole('button', { name: 'Later' }).click();
	await expect(page.getByRole('status')).not.toBeVisible();
});

async function mockAppVersionEndpoint(page: Page, state: VersionRouteState) {
	await page.route('**/app-version.json*', async (route) => {
		if (!state.deployedVersion) {
			await route.fulfill({
				status: 404,
				body: '',
			});
			return;
		}

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				schema: 'personal-wp-app-version/v1',
				buildVersion: state.deployedVersion,
			}),
		});
	});
}
