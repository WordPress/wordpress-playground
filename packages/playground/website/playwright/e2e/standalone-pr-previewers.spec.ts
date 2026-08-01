import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function submit(page: Page, value: string) {
	await page.locator('#pr-number').fill(value);
	await page.locator('#submit').click();
}

test('wordpress.html: pasting a Gutenberg PR URL points to the Gutenberg previewer', async ({
	page,
}) => {
	await page.goto('./wordpress.html');
	await submit(page, 'https://github.com/WordPress/gutenberg/pull/78937');
	await expect(
		page.getByRole('link', { name: 'Gutenberg PR previewer' })
	).toHaveAttribute('href', './gutenberg.html');
});

test('wordpress.html: non-PR input shows a wordpress-develop-specific error', async ({
	page,
}) => {
	await page.goto('./wordpress.html');
	await submit(page, 'not-a-pr');
	await expect(page.locator('#error')).toHaveText(
		'Please enter a valid wordpress-develop PR number or URL.'
	);
});

test('wordpress.html: malformed wordpress-develop PR URL shows a validation error', async ({
	page,
}) => {
	await page.goto('./wordpress.html');
	await submit(
		page,
		'https://github.com/WordPress/wordpress-develop/pull/not-a-number'
	);
	await expect(page.locator('#error')).toHaveText(
		'Please enter a valid wordpress-develop PR number or URL.'
	);
});

test('wordpress.html: a numeric PR is forwarded to plugin-proxy', async ({
	page,
}) => {
	let capturedUrl = '';
	await page.route('**/plugin-proxy.php*', (route) => {
		capturedUrl = route.request().url();
		return route.fulfill({
			status: 400,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'artifact_expired' }),
		});
	});
	await page.goto('./wordpress.html');
	await submit(page, '12345');
	await expect(page.locator('#error')).toContainText('artifact has expired');
	expect(capturedUrl).toContain('repo=wordpress-develop');
	expect(capturedUrl).toContain('pr=12345');
});

test('wordpress.html: whitespace around the PR value is trimmed', async ({
	page,
}) => {
	let capturedUrl = '';
	await page.route('**/plugin-proxy.php*', (route) => {
		capturedUrl = route.request().url();
		return route.fulfill({
			status: 400,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'artifact_expired' }),
		});
	});
	await page.goto('./wordpress.html');
	await submit(page, '  12345\n');
	await expect(page.locator('#error')).toContainText('artifact has expired');
	expect(capturedUrl).toContain('pr=12345');
});

test('gutenberg.html: pasting a wordpress-develop PR URL points to the WordPress previewer', async ({
	page,
}) => {
	await page.goto('./gutenberg.html');
	await submit(
		page,
		'https://github.com/WordPress/wordpress-develop/pull/9999'
	);
	await expect(
		page.getByRole('link', { name: 'WordPress PR previewer' })
	).toHaveAttribute('href', './wordpress.html');
});

test('gutenberg.html: non-PR input shows a gutenberg-specific error', async ({
	page,
}) => {
	await page.goto('./gutenberg.html');
	await submit(page, 'oh-no');
	await expect(page.locator('#error')).toHaveText(
		'Please enter a valid gutenberg PR number or URL.'
	);
});

test('gutenberg.html: malformed Gutenberg PR URL shows a validation error', async ({
	page,
}) => {
	await page.goto('./gutenberg.html');
	await submit(
		page,
		'https://github.com/WordPress/gutenberg/pull/not-a-number'
	);
	await expect(page.locator('#error')).toHaveText(
		'Please enter a valid gutenberg PR number or URL.'
	);
});

test('gutenberg.html: ?pr= URL param is extracted before reaching plugin-proxy', async ({
	page,
}) => {
	let capturedUrl = '';
	await page.route('**/plugin-proxy.php*', (route) => {
		capturedUrl = route.request().url();
		return route.fulfill({
			status: 400,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'no_ci_runs' }),
		});
	});
	await page.goto(
		'./gutenberg.html?pr=' +
			encodeURIComponent(
				'https://github.com/WordPress/gutenberg/pull/78937'
			)
	);
	await expect(page.locator('#error')).toContainText(
		'does not exist or GitHub CI did not finish'
	);
	expect(capturedUrl).toContain('repo=gutenberg');
	expect(capturedUrl).toContain('pr=78937');
	expect(capturedUrl).not.toContain('github.com');
});
