import { test, expect } from '@playwright/test';

// These tests cover entry into the viewer, without starting its HTTP transport.
test.use({ serviceWorkers: 'block' });

// The entry point and the form use separate code paths. A session in a URL must
// never start signaling, even when a legacy link points straight at /connect/.
for (const path of [
	'/?share=untrusted-session',
	'/connect/?share=untrusted-session',
]) {
	test(`requires code entry for ${path}`, async ({ page }) => {
		const relayRequests: string[] = [];
		await page.route('**/relay.php?**', async (route) => {
			relayRequests.push(route.request().url());
			await route.fulfill({ status: 404, json: {} });
		});

		await page.goto(path);
		await expect(page.getByLabel('Access code')).toBeVisible();
		await page.waitForLoadState('networkidle');
		expect(relayRequests).toEqual([]);
	});
}

// Resolving a code may mount the viewer, but must not create a reusable session
// URL. A document reload must return to code entry rather than resume signaling.
test('opens the viewer only after code entry and forgets the session on reload', async ({
	page,
}) => {
	const relayRequests: string[] = [];
	await page.route('**/relay.php?**', async (route) => {
		const url = new URL(route.request().url());
		relayRequests.push(url.href);
		if (url.searchParams.get('action') === 'code') {
			expect(url.searchParams.get('accessCode')).toBe('123-456');
			await route.fulfill({ json: { sessionId: 'resolved-session' } });
		} else {
			await route.fulfill({ status: 404, json: {} });
		}
	});

	await page.goto('/connect/');
	await page.getByLabel('Access code').fill('123456');
	await page.getByRole('button', { name: 'Connect', exact: true }).click();
	await expect(
		page.getByText('Using My WordPress from the host device')
	).toBeVisible();
	await expect(page).toHaveURL('/connect/');
	expect(relayRequests.some((url) => url.includes('action=code'))).toBe(true);

	await page.reload();
	await expect(page.getByLabel('Access code')).toBeVisible();
	relayRequests.length = 0;
	await page.waitForLoadState('networkidle');
	expect(relayRequests).toEqual([]);
});
