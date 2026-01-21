import { test, expect } from '../playground-fixtures.ts';

/**
 * Helper function to open the "Additional actions" dropdown menu in the site info panel.
 * The Share menu item is inside this dropdown, accessed via the three-dot (moreVertical) button.
 */
async function openAdditionalActionsMenu(
	website: Awaited<Parameters<Parameters<typeof test>[1]>[0]['website']>
) {
	// Click the "Additional actions" button (three-dot menu) in the site info panel
	const additionalActionsButton = website.page.getByRole('button', {
		name: 'Additional actions',
	});
	await additionalActionsButton.click();
	// Wait for the dropdown menu to be visible
	await website.page.waitForTimeout(200);
}

test.describe('Sharing Feature', () => {
	test('should display Share menu item in site manager dropdown', async ({
		website,
	}) => {
		await website.goto('./');
		await website.ensureSiteManagerIsOpen();

		// Open the additional actions dropdown
		await openAdditionalActionsMenu(website);

		// Look for the Share menu item in the dropdown
		const shareMenuItem = website.page.getByRole('menuitem', {
			name: /Share/,
		});
		await expect(shareMenuItem).toBeVisible();
	});

	test('should open share modal when Share is clicked', async ({ website }) => {
		await website.goto('./');
		await website.ensureSiteManagerIsOpen();

		// Open the additional actions dropdown and click Share
		await openAdditionalActionsMenu(website);
		const shareMenuItem = website.page.getByRole('menuitem', {
			name: /Share/,
		});
		await shareMenuItem.click();

		// Verify the share modal is visible by looking for the dialog with the title
		const shareModal = website.page.getByRole('dialog', {
			name: 'Share Playground',
		});
		await expect(shareModal).toBeVisible();

		// Verify the Start Sharing button is visible
		await expect(
			website.page.getByRole('button', { name: 'Start Sharing' })
		).toBeVisible();
	});

	test('should start sharing and display share URL', async ({
		website,
		context,
		browserName,
	}) => {
		test.skip(
			browserName === 'firefox',
			'Firefox does not support clipboard-read permission through Playwright'
		);

		// Grant clipboard permissions
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);

		await website.goto('./');
		await website.ensureSiteManagerIsOpen();

		// Open the additional actions dropdown and click Share
		await openAdditionalActionsMenu(website);
		const shareMenuItem = website.page.getByRole('menuitem', {
			name: /Share/,
		});
		await shareMenuItem.click();

		// Click Start Sharing
		await website.page.getByRole('button', { name: 'Start Sharing' }).click();

		// Wait for the share URL to appear (the TextControl has label "Share URL")
		const shareUrlInput = website.page.getByLabel('Share URL');
		await expect(shareUrlInput).toBeVisible({ timeout: 15000 });

		// Verify the URL contains the share parameter
		const shareUrl = await shareUrlInput.inputValue();
		expect(shareUrl).toContain('?share=');

		// Verify Stop Sharing button is now visible
		await expect(
			website.page.getByRole('button', { name: 'Stop Sharing' })
		).toBeVisible();

		// Verify Copy button is visible
		await expect(
			website.page.getByRole('button', { name: 'Copy' })
		).toBeVisible();
	});

	test('should stop sharing when Stop Sharing is clicked', async ({
		website,
	}) => {
		await website.goto('./');
		await website.ensureSiteManagerIsOpen();

		// Open the additional actions dropdown and click Share
		await openAdditionalActionsMenu(website);
		const shareMenuItem = website.page.getByRole('menuitem', {
			name: /Share/,
		});
		await shareMenuItem.click();

		// Click Start Sharing
		await website.page.getByRole('button', { name: 'Start Sharing' }).click();

		// Wait for sharing to start
		await expect(
			website.page.getByRole('button', { name: 'Stop Sharing' })
		).toBeVisible({ timeout: 15000 });

		// Click Stop Sharing
		await website.page.getByRole('button', { name: 'Stop Sharing' }).click();

		// Verify Start Sharing button is visible again
		await expect(
			website.page.getByRole('button', { name: 'Start Sharing' })
		).toBeVisible({ timeout: 5000 });
	});

	test('should copy share URL to clipboard when Copy is clicked', async ({
		website,
		context,
		browserName,
	}) => {
		test.skip(
			browserName === 'firefox',
			'Firefox does not support clipboard-read permission through Playwright'
		);

		// Grant clipboard permissions
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);

		await website.goto('./');
		await website.ensureSiteManagerIsOpen();

		// Open the additional actions dropdown and click Share
		await openAdditionalActionsMenu(website);
		const shareMenuItem = website.page.getByRole('menuitem', {
			name: /Share/,
		});
		await shareMenuItem.click();

		// Click Start Sharing
		await website.page.getByRole('button', { name: 'Start Sharing' }).click();

		// Wait for sharing to start
		await expect(
			website.page.getByRole('button', { name: 'Copy' })
		).toBeVisible({ timeout: 15000 });

		// Get the share URL from the input
		const shareUrlInput = website.page.getByLabel('Share URL');
		const expectedUrl = await shareUrlInput.inputValue();

		// Click Copy
		await website.page.getByRole('button', { name: 'Copy' }).click();

		// Verify clipboard contains the share URL
		const clipboardContent = await website.page.evaluate(() =>
			navigator.clipboard.readText()
		);
		expect(clipboardContent).toBe(expectedUrl);
	});

	test.describe('Guest Viewing', () => {
		test('should display shared playground viewer for guests', async ({
			page,
		}) => {
			// Create a fake share session ID
			const fakeSessionId = 'test-session-' + Date.now();

			// Navigate directly to a share URL (this will show connecting state
			// since the session doesn't exist)
			await page.goto(`./?share=${fakeSessionId}`);

			// Verify the shared playground viewer is displayed
			await expect(
				page.locator('text=Viewing a shared Playground')
			).toBeVisible();

			// Verify the "Create your own Playground" link is visible
			await expect(
				page.getByRole('link', { name: 'Create your own Playground' })
			).toBeVisible();
		});

		test('should navigate to regular playground when clicking Create your own', async ({
			page,
		}) => {
			// Create a fake share session ID
			const fakeSessionId = 'test-session-' + Date.now();

			// Navigate to a share URL
			await page.goto(`./?share=${fakeSessionId}`);

			// Wait for the viewer to load
			await expect(
				page.locator('text=Viewing a shared Playground')
			).toBeVisible();

			// Click "Create your own Playground" link
			const createOwnLink = page.getByRole('link', {
				name: 'Create your own Playground',
			});
			await createOwnLink.click();

			// Verify we're now on the regular playground page (no share parameter)
			await page.waitForURL((url) => !url.searchParams.has('share'));
		});
	});

	test.describe('End-to-end sharing flow', () => {
		test('should allow guest to view host playground through relay', async ({
			website,
			context,
		}) => {
			// Start host sharing
			await website.goto('./');
			await website.ensureSiteManagerIsOpen();

			// Open the additional actions dropdown and click Share
			await openAdditionalActionsMenu(website);
			const shareMenuItem = website.page.getByRole('menuitem', {
				name: /Share/,
			});
			await shareMenuItem.click();

			await website.page
				.getByRole('button', { name: 'Start Sharing' })
				.click();

			// Wait for share URL
			const shareUrlInput = website.page.getByLabel('Share URL');
			await expect(shareUrlInput).toBeVisible({ timeout: 20000 });

			const shareUrl = await shareUrlInput.inputValue();
			expect(shareUrl).toContain('?share=');

			// Open a new page as guest
			const guestPage = await context.newPage();
			await guestPage.goto(shareUrl);

			// Verify guest sees the shared playground viewer
			await expect(
				guestPage.locator('text=Viewing a shared Playground')
			).toBeVisible();

			// Wait for connection to be established
			await expect(guestPage.locator('text=Connected')).toBeVisible({
				timeout: 30000,
			});

			// Verify the iframe is loaded with WordPress content
			const guestIframe = guestPage.frameLocator(
				'iframe[title="Shared WordPress Playground"]'
			);

			// Wait for WordPress content to load through the relay
			// The guest should see the WordPress site with the admin bar
			await expect(guestIframe.locator('#wpadminbar')).toBeVisible({
				timeout: 30000,
			});

			// Clean up
			await guestPage.close();

			// Stop sharing
			await website.page
				.getByRole('button', { name: 'Stop Sharing' })
				.click();
		});
	});
});
