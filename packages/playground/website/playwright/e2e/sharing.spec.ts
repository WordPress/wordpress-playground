import type { Page } from '@playwright/test';
import { test, expect } from '../playground-fixtures.ts';

type Website = Awaited<Parameters<Parameters<typeof test>[1]>[0]['website']>;

/**
 * Helper function to open the "Additional actions" dropdown menu in the site info panel.
 * The Share menu item is inside this dropdown, accessed via the three-dot (moreVertical) button.
 */
async function openAdditionalActionsMenu(website: Website) {
	// Click the "Additional actions" button (three-dot menu) in the site info panel
	const additionalActionsButton = website.page.getByRole('button', {
		name: 'Additional actions',
	});
	await additionalActionsButton.click();
	// Wait for the dropdown menu to be visible
	await website.page.waitForTimeout(200);
}

/**
 * Helper that opens the share modal via the prominent Share button in
 * the main toolbar (the one most users actually see). The site manager
 * dropdown path is still covered by the older tests above.
 */
async function openShareModalFromToolbar(website: Website) {
	await website.page.getByTestId('share-playground-button').click();
	const shareModal = website.page.getByRole('dialog', {
		name: 'Share Playground',
	});
	await expect(shareModal).toBeVisible();
}

/**
 * Helper that drives the host through the full "click toolbar Share →
 * Start Sharing" flow and returns the resulting share URL once the
 * modal is in its sharing state. Used by every multi-tab test below.
 */
async function startSharingFromToolbar(website: Website): Promise<string> {
	await openShareModalFromToolbar(website);
	await website.page.getByRole('button', { name: 'Start Sharing' }).click();
	const shareUrlInput = website.page.getByLabel('Share URL');
	await expect(shareUrlInput).toBeVisible({ timeout: 20000 });
	const shareUrl = await shareUrlInput.inputValue();
	expect(shareUrl).toContain('?share=');
	return shareUrl;
}

/**
 * Force a guest heartbeat using the page's own sessionStorage UUID.
 *
 * Why this exists: SharedPlaygroundViewer fires a heartbeat every 3s on
 * a setInterval, but headless Chromium aggressively throttles timers in
 * background tabs — we observed gaps of 20+ seconds between fires when
 * the host page was brought to the front. The relay prunes guests after
 * 10 seconds of silence, so the test would race against the throttling
 * and see the same guest get pruned and re-registered with a fresh
 * ordinal mid-flight, breaking assertions on the collaborator list.
 *
 * Driving the heartbeat by hand from the test makes this race vanish.
 * The production code path is still exercised by the existing
 * "should allow guest to view host playground through relay" test,
 * which lets the timer run naturally.
 */
async function pingGuestHeartbeat(guest: Page): Promise<void> {
	await guest.evaluate(async () => {
		const m = window.location.search.match(/[?&]share=([^&]+)/);
		if (!m) throw new Error('guest page has no ?share= param');
		const sessionId = m[1];
		const KEY = 'wp-playground-share-guest-id';
		let gid = sessionStorage.getItem(KEY);
		if (!gid) {
			gid = crypto.randomUUID();
			sessionStorage.setItem(KEY, gid);
		}
		await fetch(
			`/relay/${sessionId}/status?gid=${encodeURIComponent(gid)}`
		);
	});
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

	test('should open share modal from the prominent toolbar Share button', async ({
		website,
	}) => {
		await website.goto('./');

		// The toolbar Share button lives directly in the browser chrome,
		// so this test deliberately does NOT open the site manager first —
		// the whole point of the toolbar button is to skip that detour.
		const toolbarShareButton = website.page.getByTestId(
			'share-playground-button'
		);
		await expect(toolbarShareButton).toBeVisible();
		await toolbarShareButton.click();

		// Same modal as the dropdown path, just reached differently.
		const shareModal = website.page.getByRole('dialog', {
			name: 'Share Playground',
		});
		await expect(shareModal).toBeVisible();
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

		test('should list collaborators as guests join and shrink the list when one leaves', async ({
			website,
			browser,
		}) => {
			// This single test covers three things in sequence so we only
			// pay the WordPress boot cost once and the join/leave timing
			// stays inside one assertion budget:
			//
			//   1. The host modal starts at "No collaborators yet".
			//   2. As two guest tabs open and heartbeat, the modal flips
			//      to "1 collaborator" then "2 collaborators connected"
			//      with both Guest 1 and Guest 2 chips visible.
			//   3. After closing guest 2, the relay prunes it (~10s) and
			//      the modal drops back to "1 collaborator connected".
			//
			// Each guest gets its own browser context. Same-context tabs
			// in Playwright/Chromium can compete for "active tab" focus,
			// and we observed the host's status-poll setInterval going
			// silent for 20+ seconds when guest tabs were opened in the
			// same context. A fresh context per guest keeps every page's
			// timers running at full speed throughout. Guest heartbeats
			// are also driven by hand (see pingGuestHeartbeat) so the
			// test doesn't race against background-tab timer throttling
			// on the guest pages themselves.
			const guestContext1 = await browser.newContext();
			const guestContext2 = await browser.newContext();

			await website.goto('./');

			const shareUrl = await startSharingFromToolbar(website);
			const collaborators = website.page.getByTestId('collaborators-list');

			await expect(
				website.page.getByText('No collaborators yet')
			).toBeVisible();

			// First guest joins.
			const guest1 = await guestContext1.newPage();
			await guest1.goto(shareUrl);
			await expect(
				guest1.locator('text=Viewing a shared Playground')
			).toBeVisible();

			await expect
				.poll(
					async () => {
						await pingGuestHeartbeat(guest1);
						return website.page
							.getByText('1 collaborator connected')
							.isVisible();
					},
					{ timeout: 15000, intervals: [500, 1000, 1500] }
				)
				.toBeTruthy();
			await expect(collaborators.getByText('Guest 1')).toBeVisible();

			// Second guest joins in its own browser context, which
			// gives it a fresh sessionStorage so its per-tab guest UUID
			// is different from guest 1's — the host should see it as
			// Guest 2.
			const guest2 = await guestContext2.newPage();
			await guest2.goto(shareUrl);
			await expect(
				guest2.locator('text=Viewing a shared Playground')
			).toBeVisible();

			await expect
				.poll(
					async () => {
						await pingGuestHeartbeat(guest1);
						await pingGuestHeartbeat(guest2);
						return website.page
							.getByText('2 collaborators connected')
							.isVisible();
					},
					{ timeout: 15000, intervals: [500, 1000, 1500] }
				)
				.toBeTruthy();
			await expect(collaborators.getByText('Guest 1')).toBeVisible();
			await expect(collaborators.getByText('Guest 2')).toBeVisible();

			// Guest 2 leaves. Guest 1 keeps heartbeating from the test,
			// so only Guest 2 ages out. The relay prunes guests after
			// ~10s of silence; allow up to 25s for the modal to refresh.
			await guest2.close();
			await expect
				.poll(
					async () => {
						await pingGuestHeartbeat(guest1);
						return website.page
							.getByText('1 collaborator connected')
							.isVisible();
					},
					{ timeout: 25000, intervals: [1000, 2000, 2000] }
				)
				.toBeTruthy();
			await expect(collaborators.getByText('Guest 1')).toBeVisible();
			await expect(collaborators.getByText('Guest 2')).not.toBeVisible();

			// Clean up.
			await guest1.close();
			await guestContext1.close();
			await guestContext2.close();
			await website.page
				.getByRole('button', { name: 'Stop Sharing' })
				.click();
		});

		test('should show the host disconnected overlay on the guest after Stop Sharing', async ({
			website,
			context,
		}) => {
			await website.goto('./');

			const shareUrl = await startSharingFromToolbar(website);

			// Open the guest and wait for it to fully connect through the
			// relay. The disconnect detection on the guest only kicks in
			// AFTER it has seen at least one hostAlive=true poll, so we
			// need a real connection here, not just a viewer mount.
			const guestPage = await context.newPage();
			await guestPage.goto(shareUrl);
			await expect(
				guestPage.locator('text=● Connected')
			).toBeVisible({ timeout: 30000 });

			// Now stop sharing on the host. This fires POST /relay/:id/close
			// (via fetch keepalive) which immediately marks the session
			// hostConnected=false and rejects pending guest requests.
			await website.page
				.getByRole('button', { name: 'Stop Sharing' })
				.click();

			// The guest's status poller (3s interval) should see hostAlive
			// flip to false on its next tick and switch into the
			// host-disconnected state.
			await expect(
				guestPage.locator('text=● Host disconnected')
			).toBeVisible({ timeout: 15000 });
			await expect(
				guestPage.getByRole('heading', { name: 'Host disconnected' })
			).toBeVisible();

			// Clean up.
			await guestPage.close();
		});
	});
});
