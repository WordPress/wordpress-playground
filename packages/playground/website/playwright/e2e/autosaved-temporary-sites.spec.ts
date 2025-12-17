import { test, expect } from '../playground-fixtures.ts';
import type { FrameLocator } from '@playwright/test';

// Autosaved temporary sites rely on OPFS, which is only available in Chromium
// in Playwright's browser flavors.
test.describe.configure({ mode: 'serial' });

function extractScopeSlug(url: string): string | null {
	const match = url.match(/\/scope:([^/]+)\//);
	return match?.[1] ?? null;
}

async function getCurrentScopeSlug(wordpress: FrameLocator): Promise<string> {
	const wpUrl = await wordpress
		.locator('body')
		.evaluate((body) => body.ownerDocument.location.href);
	const scopeSlug = extractScopeSlug(wpUrl);
	expect(
		scopeSlug,
		`Expected WordPress iframe URL to include /scope:<slug>/, got ${wpUrl}`
	).not.toBeNull();
	return scopeSlug!;
}

test('refreshing a Query API URL creates a new autosaved site (no site-slug)', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./?plugin=gutenberg');
	expect(new URL(website.page.url()).searchParams.get('site-slug')).toBeNull();

	const scopeA = await getCurrentScopeSlug(wordpress);

	await website.page.reload();
	await website.waitForNestedIframes();

	expect(new URL(website.page.url()).searchParams.get('site-slug')).toBeNull();
	const scopeB = await getCurrentScopeSlug(wordpress);
	expect(scopeB).not.toBe(scopeA);
});

test('explicitly opening an autosave uses site-slug and persists on refresh', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./?plugin=gutenberg');
	expect(new URL(website.page.url()).searchParams.get('site-slug')).toBeNull();

	await website.ensureSiteManagerIsOpen();
	await website.openSavedPlaygroundsOverlay();

	const autosavedButtons = website.page
		.getByRole('heading', { name: 'Auto-saved' })
		.locator(
			'xpath=following-sibling::div[contains(@class, "sitesList")]//button[contains(@class, "siteRowContent")]'
		);
	await expect(autosavedButtons.first()).toBeVisible();
	await autosavedButtons.first().click();

	await expect(website.page).toHaveURL(/site-slug=/);
	const siteSlug = new URL(website.page.url()).searchParams.get('site-slug');
	expect(siteSlug).not.toBeNull();

	// The active site should be served from the matching scope path.
	expect(await getCurrentScopeSlug(wordpress)).toBe(siteSlug);

	await website.page.reload();
	await website.waitForNestedIframes();

	expect(new URL(website.page.url()).searchParams.get('site-slug')).toBe(
		siteSlug
	);
	expect(await getCurrentScopeSlug(wordpress)).toBe(siteSlug);
});

