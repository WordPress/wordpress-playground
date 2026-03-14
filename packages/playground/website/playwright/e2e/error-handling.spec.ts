import { test, expect } from '@playwright/test';

test('should show inline fallback when the main module fails to load', async ({
	page,
}) => {
	// Block all requests for the main app module (initial + cache-busted retry)
	await page.route(/\/src\/main/, (route) => route.abort('failed'));

	await page.goto('./');

	const heading = page.locator('h1', {
		hasText: 'Could not load WordPress Playground',
	});
	await expect(heading).toBeVisible();

	const reloadButton = page.locator('button', {
		hasText: 'Try again',
	});
	await expect(reloadButton).toBeVisible();
});

test('should show download error modal when a resource download fails', async ({
	page,
}) => {
	await page.goto('./');

	// Wait for the Redux store to be available and an active site
	// to exist (the store is exposed on window in dev mode).
	await page.waitForFunction(() => {
		const store = (window as any).__PLAYGROUND_STORE__;
		return store && store.getState().ui.activeSite?.slug;
	});

	// Dispatch a resource-download-failed error through the store.
	// The error detection logic is covered by unit tests; this E2E
	// test verifies that the modal renders the right content.
	await page.evaluate(() => {
		const store = (window as any).__PLAYGROUND_STORE__;
		store.dispatch({
			type: 'ui/setActiveSiteError',
			payload: {
				error: 'resource-download-failed',
				details: 'TypeError: Failed to fetch',
			},
		});
	});

	const title = page.getByText('Could not download required files');
	await expect(title).toBeVisible();

	const body = page.getByText('usually caused by a network problem');
	await expect(body).toBeVisible();

	const reloadButton = page.getByRole('button', {
		name: 'Reload page',
	});
	await expect(reloadButton).toBeVisible();
});
