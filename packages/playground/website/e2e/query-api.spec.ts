import { test, expect } from './wordpress-fixtures';

test('should load PHP 8.0 by default', async ({ page, wordpressPage }) => {
	// Navigate to the page
	await page.goto('./?url=/phpinfo.php');

	// Find the h1 element and check its content
	const h1 = wordpressPage.locator('h1.p').first();
	await expect(h1).toContainText('PHP Version 8.0');
});
