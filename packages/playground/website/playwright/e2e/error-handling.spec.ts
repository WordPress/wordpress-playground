import { test, expect } from '@playwright/test';

test('should show inline fallback when the main module fails to load', async ({
	page,
}) => {
	// Block all requests for the main app module (initial + cache-busted retry).
	// In dev mode Vite serves `/src/main.tsx`; in production builds
	// it becomes `/assets/main-[hash].js`.
	await page.route(/\/(src|assets)\/main/, (route) => route.abort('failed'));

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
	// Block plugin downloads so the blueprint step triggers a real
	// resource-download-failed error through the normal error pipeline.
	await page.route(/downloads\.wordpress\.org/, (route) =>
		route.abort('failed')
	);

	// The ?plugin param adds an installPlugin blueprint step that
	// fetches the zip from downloads.wordpress.org via the CORS proxy.
	await page.goto('./?plugin=hello-dolly');

	const title = page.getByText('Could not download required files');
	await expect(title).toBeVisible();

	const body = page.getByText('usually caused by a network problem');
	await expect(body).toBeVisible();

	const reloadButton = page.getByRole('button', {
		name: 'Reload page',
	});
	await expect(reloadButton).toBeVisible();
});
