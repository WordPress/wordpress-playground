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
	// Patch fetch so that any request to downloads.wordpress.org
	// rejects with a TypeError. Using addInitScript rather than
	// page.route because the CORS proxy puts the target URL in
	// the query string and WebKit's page.route does not match
	// regex patterns against query parameters.
	await page.addInitScript(() => {
		const originalFetch = window.fetch;
		window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
			const url = input instanceof Request ? input.url : String(input);
			if (url.includes('downloads.wordpress.org')) {
				return Promise.reject(new TypeError('Failed to fetch'));
			}
			return originalFetch.call(this, input, init);
		} as typeof fetch;
	});

	// Use an explicit Blueprint step so plugin download failures still
	// surface as boot errors. The Query API's ?plugin=... path intentionally
	// skips missing plugins to preserve the rest of the requested setup.
	const blueprint = {
		steps: [
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'wordpress.org/plugins',
					slug: 'hello-dolly',
				},
			},
		],
	};
	await page.goto(
		`./?storage=temp#${encodeURIComponent(JSON.stringify(blueprint))}`
	);

	const title = page.getByText('Could not download required files');
	await expect(title).toBeVisible();

	const body = page.getByText('usually caused by a network problem');
	await expect(body).toBeVisible();

	const failedFile = page.getByRole('link', {
		name:
			'https://downloads.wordpress.org/plugin/' +
			'hello-dolly.latest-stable.zip',
	});
	await expect(failedFile).toBeVisible();

	const reloadButton = page.getByRole('button', {
		name: 'Reload page',
	});
	await expect(reloadButton).toBeVisible();
});

test('should say when the Blueprint file could not be downloaded', async ({
	page,
}) => {
	const blueprintUrl = 'https://example.com/missing-blueprint.json';
	await page.addInitScript((urlToFail) => {
		const originalFetch = window.fetch;
		window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
			const url = input instanceof Request ? input.url : String(input);
			if (url === urlToFail) {
				return Promise.reject(new TypeError('Failed to fetch'));
			}
			return originalFetch.call(this, input, init);
		} as typeof fetch;
	}, blueprintUrl);

	await page.goto(`./?blueprint-url=${encodeURIComponent(blueprintUrl)}`);

	await expect(
		page.getByText('Blueprint could not be downloaded')
	).toBeVisible();
	await expect(page.getByRole('link', { name: blueprintUrl })).toBeVisible();
});
