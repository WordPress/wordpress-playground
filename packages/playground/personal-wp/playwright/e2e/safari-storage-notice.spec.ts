import { test, expect, type Page } from '../playground-fixtures';

const NOTICE_HEADING = 'Safari may erase your WordPress data after 7 days';
const DISMISS_KEY = 'playground-safari-storage-notice-dismissed';
const LEGACY_DISMISS_KEY = 'playground-ios-pwa-notice-dismissed';

const IOS_SAFARI_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
	'AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
	'Version/17.0 Mobile/15E148 Safari/604.1';

const MACOS_SAFARI_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) ' +
	'AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
	'Version/18.0 Safari/605.1.15';

const noticeHeading = (page: Page) =>
	page.getByText(NOTICE_HEADING, { exact: true }).first();

test.describe('Safari storage notice on iOS Safari', () => {
	test.use({
		userAgent: IOS_SAFARI_UA,
		viewport: { width: 390, height: 664 },
		isMobile: true,
		hasTouch: true,
	});

	test('shows Add to Home Screen instructions and persists dismissal', async ({
		page,
	}) => {
		await clearNoticeDismissal(page);

		await page.goto('./');

		await expect(noticeHeading(page)).toBeVisible();
		await expect(
			page.locator('p').filter({ hasText: 'Add to Home Screen' })
		).toBeVisible();

		await page.getByRole('button', { name: 'Dismiss' }).click();
		await expect(noticeHeading(page)).toBeHidden();

		await page.reload();
		await expect(noticeHeading(page)).toBeHidden();
	});

	test('does not show when running as an installed web app', async ({
		page,
	}) => {
		await clearNoticeDismissal(page);
		await page.addInitScript(() => {
			Object.defineProperty(window.navigator, 'standalone', {
				value: true,
				configurable: true,
			});
		});

		await page.goto('./');

		await expect(noticeHeading(page)).toBeHidden();
	});
});

test.describe('Safari storage notice on macOS Safari', () => {
	test.use({
		userAgent: MACOS_SAFARI_UA,
		viewport: { width: 1280, height: 720 },
		isMobile: false,
		hasTouch: false,
	});

	test('shows Add to Dock instructions', async ({ page }) => {
		await clearNoticeDismissal(page);

		await page.goto('./');

		await expect(noticeHeading(page)).toBeVisible();
		await expect(
			page.locator('p').filter({ hasText: 'Add to Dock' })
		).toBeVisible();
	});
});

async function clearNoticeDismissal(page: Page) {
	await page.addInitScript(
		({ dismissKey, legacyDismissKey }) => {
			localStorage.removeItem(dismissKey);
			localStorage.removeItem(legacyDismissKey);
		},
		{ dismissKey: DISMISS_KEY, legacyDismissKey: LEGACY_DISMISS_KEY }
	);
}
