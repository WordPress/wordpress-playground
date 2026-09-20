import { test, expect } from '@playwright/test';

const rawBasePath = process.env.DOCS_E2E_BASE_PATH ?? '/wordpress-playground';
const normalizedBasePath =
	rawBasePath === '/' ? '/' : `/${rawBasePath.replace(/^\/|\/$/g, '')}`;
const apiPath =
	process.env.DOCS_E2E_API_PATH ??
	`${normalizedBasePath === '/' ? '' : normalizedBasePath}/api`;

const STUB_CONTENT_TYPES: Record<string, string> = {
	script: 'application/javascript',
	stylesheet: 'text/css',
};

test.describe('Docs API reference', () => {
	test('loads without runtime errors', async ({ page, baseURL }) => {
		const pageErrors: Error[] = [];
		const consoleErrors: string[] = [];

		page.on('pageerror', (error) => {
			pageErrors.push(error);
		});

		page.on('console', (message) => {
			if (message.type() === 'error') {
				const text = message.text();
				// Ignore benign production React hint that is injected in dev.
				if (text.includes('Download the React DevTools')) {
					return;
				}
				consoleErrors.push(text);
			}
		});

		// This test covers the docs build, not third-party widgets such as
		// the kapa.ai assistant. Answer every cross-origin request with a
		// typed empty stub so they never load and the browser has nothing
		// to log about them.
		const docsOrigin = new URL(baseURL!).origin;
		await page.route('**/*', (route) => {
			if (new URL(route.request().url()).origin === docsOrigin) {
				return route.continue();
			}
			const contentType =
				STUB_CONTENT_TYPES[route.request().resourceType()];
			return contentType
				? route.fulfill({ status: 200, contentType, body: '' })
				: route.fulfill({ status: 204 });
		});

		await page.goto(apiPath, {
			waitUntil: 'domcontentloaded',
		});
		await expect(page.locator('.apiPage')).toBeVisible({ timeout: 30000 });

		expect(
			pageErrors,
			pageErrors.map((error) => error.message).join('\n')
		).toHaveLength(0);
		expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
	});
});
