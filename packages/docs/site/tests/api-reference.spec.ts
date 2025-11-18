import { test, expect } from '@playwright/test';

const rawBasePath = process.env.DOCS_E2E_BASE_PATH ?? '/wordpress-playground';
const normalizedBasePath =
	rawBasePath === '/' ? '/' : `/${rawBasePath.replace(/^\/|\/$/g, '')}`;
const apiPath =
	process.env.DOCS_E2E_API_PATH ??
	`${normalizedBasePath === '/' ? '' : normalizedBasePath}/api`;

test.describe('Docs API reference', () => {
	test('loads without runtime errors', async ({ page }) => {
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

		await page.goto(apiPath, {
			waitUntil: 'networkidle',
		});
		await expect(page.locator('.apiPage')).toBeVisible();

		expect(
			pageErrors,
			pageErrors.map((error) => error.message).join('\n')
		).toHaveLength(0);
		expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
	});
});
