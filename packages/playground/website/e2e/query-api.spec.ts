import { test, expect } from '@playwright/test';

test('should load PHP 8.0 by default', async ({ page }) => {
	// Navigate to the page
	await page.goto('/website-server/?url=/phpinfo.php');

	// Find the h1 element and check its content
	const h1 = await page
		.frameLocator('#playground-viewport')
		.frameLocator('#wp')
		.locator('h1.p')
		.first();
	await expect(h1).toContainText('PHP Version 8.0');
});
