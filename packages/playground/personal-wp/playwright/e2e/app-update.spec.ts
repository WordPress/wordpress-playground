import { test, expect } from '../playground-fixtures';
import type { BrowserContext, Page } from '@playwright/test';

type VersionRouteState = {
	deployedVersion?: string;
};

test.describe.configure({ mode: 'serial' });

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

	await expect(updateNotice(page)).toContainText('Update available');
	await page.getByRole('button', { name: 'Later' }).click();
	await expect(updateNotice(page)).not.toBeVisible();
});

test('reloads the app when Update now is clicked', async ({
	website,
	page,
}) => {
	const versionRouteState: VersionRouteState = {};
	await mockAppVersionEndpoint(page, versionRouteState);

	await website.goto('./');
	versionRouteState.deployedVersion = 'newer-build';
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));

	await expect(updateNotice(page)).toContainText('Update available');
	await serveAppShellForMainFrameReload(page);
	versionRouteState.deployedVersion = undefined;
	const previousTimeOrigin = await page.evaluate(
		() => performance.timeOrigin
	);
	const reloadPromise = page.waitForEvent('load');
	await page.getByRole('button', { name: 'Update now' }).click();
	await reloadPromise;

	await expect
		.poll(() => page.evaluate(() => performance.timeOrigin))
		.not.toBe(previousTimeOrigin);
	await website.waitForNestedIframes();
	await expect(updateNotice(page)).not.toBeVisible();
});

test('allows app boot when the version check fails', async ({
	website,
	page,
}) => {
	await page.route('**/app-version.json*', async (route) => {
		await route.abort();
	});

	await website.goto('./');

	await expect(
		page.locator('#playground-viewport, .playground-viewport')
	).toBeVisible();
});

test('broadcasts the update notice to another open tab', async ({
	context,
	website,
	page,
}) => {
	const versionRouteState: VersionRouteState = {};
	await mockAppVersionEndpoint(context, versionRouteState);

	await website.goto('./');
	const secondPage = await context.newPage();
	try {
		await secondPage.goto('./');
		await waitForAppShell(secondPage);

		versionRouteState.deployedVersion = 'newer-build';
		await page.evaluate(() => window.dispatchEvent(new Event('focus')));

		await expect(updateNotice(page)).toContainText('Update available');
		await expect(updateNotice(secondPage)).toContainText(
			'Update available'
		);
	} finally {
		await secondPage.close();
	}
});

function updateNotice(page: Page) {
	return page.getByRole('status').filter({ hasText: 'Update available' });
}

async function waitForAppShell(page: Page) {
	await expect(
		page.locator('#playground-viewport, .playground-viewport')
	).toBeVisible();
}

async function serveAppShellForMainFrameReload(page: Page) {
	const currentPath = new URL(page.url()).pathname;
	await page.route(`**${currentPath}`, async (route) => {
		const request = route.request();
		if (
			!request.isNavigationRequest() ||
			request.frame() !== page.mainFrame()
		) {
			await route.continue();
			return;
		}

		// The production deployment rewrites app paths back to the app shell.
		const appShellUrl = new URL('/website-server/', request.url());
		const response = await page.request.get(appShellUrl.toString());
		await route.fulfill({ response });
	});
}

async function mockAppVersionEndpoint(
	target: Page | BrowserContext,
	state: VersionRouteState
) {
	await target.route('**/app-version.json*', async (route) => {
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
