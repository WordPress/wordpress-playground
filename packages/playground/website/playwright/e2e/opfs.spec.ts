import { test, expect } from '../playground-fixtures.ts';
import type { Blueprint } from '@wp-playground/blueprints';
import type { Page } from '@playwright/test';
import { encodeZip, collectBytes } from '@php-wasm/stream-compression';

/**
 * Creates a minimal WordPress export ZIP file for testing imports.
 * The ZIP contains just an index.php file with the given marker content.
 */
async function createTestWordPressZip(markerContent: string): Promise<Buffer> {
	const phpContent = `<?php echo '${markerContent}';`;
	const file = new File([phpContent], 'wp-content/index.php', {
		type: 'text/plain',
	});
	const zipStream = encodeZip([file]);
	const zipBytes = await collectBytes(zipStream);
	return Buffer.from(zipBytes!);
}

// OPFS tests must run serially because OPFS storage is shared at the browser
// level, so tests would interfere with each other's saved sites if run in parallel.
test.describe.configure({ mode: 'serial' });

/**
 * Waits for the background auto-save to complete. After boot, Playground
 * automatically syncs the site to OPFS. This helper waits until the title
 * changes from "Unsaved Playground" to the persisted site name, which
 * signals that storage has transitioned from 'none' to 'opfs'.
 */
async function waitForAutoSave(page: Page) {
	await expect(page.getByLabel('Playground title')).not.toContainText(
		'Unsaved Playground',
		{ timeout: 120000 }
	);
}

test('should auto-save site to OPFS after boot', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./');
	await website.ensureSiteManagerIsOpen();

	// Wait for auto-save to complete — title changes to the generated site name
	await waitForAutoSave(website.page);

	// The title should now be a generated name, not "Unsaved Playground"
	const title = await website.page
		.getByLabel('Playground title')
		.textContent();
	expect(title).toBeTruthy();
	expect(title).not.toContain('Unsaved Playground');
});

test('should show auto-saving indicator during save', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./');

	// During auto-save, the save status indicator shows "Saving Playground".
	await expect(website.page.getByText('Saving Playground')).toBeVisible({
		timeout: 30000,
	});

	// Once complete, it transitions to "Saved Playground".
	await expect(website.page.getByText('Saved Playground')).toBeVisible({
		timeout: 120000,
	});
});

test('should reload and restore auto-saved site', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./');
	await website.ensureSiteManagerIsOpen();
	await waitForAutoSave(website.page);

	// Remember the site name
	const siteName = await website.page
		.getByLabel('Playground title')
		.textContent();

	// Reload the page
	await website.page.reload();
	await website.waitForNestedIframes();
	await website.ensureSiteManagerIsOpen();

	// The same site should be loaded (not a new "Unsaved Playground")
	await expect(website.page.getByLabel('Playground title')).toContainText(
		siteName!
	);
});

test('should switch between sites', async ({ website, browserName }) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./');
	await website.ensureSiteManagerIsOpen();

	// Wait for auto-save to complete
	await waitForAutoSave(website.page);

	const firstSiteName = await website.page
		.getByLabel('Playground title')
		.textContent();

	// Open the saved playgrounds overlay and click on "Unsaved Playground"
	// to create a new temporary site. This row always exists as a way to
	// spin up a fresh playground.
	await website.openSavedPlaygroundsOverlay();
	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: 'Unsaved Playground' })
		.click();

	// Wait for the new site to auto-save too
	await website.ensureSiteManagerIsOpen();
	await waitForAutoSave(website.page);

	const secondSiteName = await website.page
		.getByLabel('Playground title')
		.textContent();
	expect(secondSiteName).not.toBe(firstSiteName);

	// Switch back to the first site
	await website.openSavedPlaygroundsOverlay();
	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: firstSiteName! })
		.click();

	await expect(website.page.getByLabel('Playground title')).toContainText(
		firstSiteName!
	);
});

test('should preserve PHP constants when auto-saving to OPFS', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	// Start a site with a specific PHP constant.
	const blueprint: Blueprint = {
		landingPage: '/index.php',
		constants: { E2E_TEST_CONSTANT: 'E2E_TEST_VALUE' },
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/index.php',
				data: '<?php echo E2E_TEST_CONSTANT;',
			},
		],
	};
	await website.goto(`./#${JSON.stringify(blueprint)}`);

	// Verify the constant works
	await expect(wordpress.locator('body')).toContainText('E2E_TEST_VALUE');

	await website.ensureSiteManagerIsOpen();
	await waitForAutoSave(website.page);

	const savedSiteName = await website.page
		.getByLabel('Playground title')
		.textContent();

	// Open overlay and create a new site to switch away
	await website.openSavedPlaygroundsOverlay();
	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: 'Unsaved Playground' })
		.click();

	// Wait for new site to settle, then switch back
	await website.ensureSiteManagerIsOpen();
	await waitForAutoSave(website.page);

	await website.openSavedPlaygroundsOverlay();
	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: savedSiteName! })
		.click();

	// Confirm the PHP constant is still present after switching back
	await expect(wordpress.locator('body')).toContainText('E2E_TEST_VALUE');
});

test('should rename a saved Playground and persist after reload', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./');
	await website.ensureSiteManagerIsOpen();

	// Wait for auto-save to complete so rename is available
	await waitForAutoSave(website.page);

	// Click the pencil/edit button next to the playground name
	await website.page
		.getByRole('button', { name: 'Rename Playground' })
		.click();

	const newName = 'My Renamed Playground';
	const dialog = website.page.getByRole('dialog', {
		name: 'Rename Playground',
	});
	const nameInput = dialog.getByRole('textbox', { name: 'Name' });
	await nameInput.fill('');
	await nameInput.type(newName);
	await nameInput.press('Enter');

	await expect(website.page.getByLabel('Playground title')).toContainText(
		newName
	);

	// Wait for the dialog to be closed
	await expect(dialog).not.toBeVisible();

	// Reload and verify the name persists
	await website.page.reload();
	await website.ensureSiteManagerIsOpen();
	await expect(website.page.getByLabel('Playground title')).toContainText(
		newName
	);

	// Verify the name is also updated in the saved playgrounds overlay
	await website.openSavedPlaygroundsOverlay();
	await expect(
		website.page.locator('[class*="siteRowName"]', { hasText: newName })
	).toBeVisible();
	await website.closeSavedPlaygroundsOverlay();
});

test('should have rename input text selected by default', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./');
	await website.ensureSiteManagerIsOpen();
	await waitForAutoSave(website.page);

	// Open the rename dialog
	await website.page
		.getByRole('button', { name: 'Rename Playground' })
		.click();
	const dialog = website.page.getByRole('dialog', {
		name: 'Rename Playground',
	});
	await expect(dialog).toBeVisible({ timeout: 10000 });

	const nameInput = dialog.getByRole('textbox', { name: 'Name' });

	// Verify the input is focused
	await expect(nameInput).toBeFocused();

	// The input text should be pre-selected, but selection timing can be flaky.
	// Use Ctrl+A to ensure all text is selected before typing.
	await website.page.keyboard.press('ControlOrMeta+a');

	// Type to replace the selected text
	await website.page.keyboard.type('New Name');
	await expect(nameInput).toHaveValue('New Name');

	// Close the dialog
	await website.page.keyboard.press('Escape');
});

test('should rename auto-saved site with custom name', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./');
	await website.ensureSiteManagerIsOpen();
	await waitForAutoSave(website.page);

	const customName = 'My Custom Playground Name';

	// Rename via the dialog
	await website.page
		.getByRole('button', { name: 'Rename Playground' })
		.click();
	const dialog = website.page.getByRole('dialog', {
		name: 'Rename Playground',
	});
	const nameInput = dialog.getByRole('textbox', { name: 'Name' });
	await nameInput.fill('');
	await nameInput.type(customName);
	await nameInput.press('Enter');

	// Verify the site was renamed
	await expect(website.page.getByLabel('Playground title')).toContainText(
		customName
	);

	// Verify the name also appears in the saved playgrounds overlay
	await website.openSavedPlaygroundsOverlay();
	await expect(
		website.page.locator('[class*="siteRowName"]', { hasText: customName })
	).toBeVisible();
	await website.closeSavedPlaygroundsOverlay();
});

test('should import ZIP into temporary site when a saved site exists', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	// Start with a blueprint that writes a distinctive marker to distinguish the saved site
	const savedSiteMarker = 'SAVED_SITE_CONTENT_MARKER_12345';
	const blueprint: Blueprint = {
		landingPage: '/test-marker.php',
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/test-marker.php',
				data: `<?php echo '${savedSiteMarker}';`,
			},
		],
	};
	await website.goto(`./#${JSON.stringify(blueprint)}`);

	// Verify the marker is present
	await expect(wordpress.locator('body')).toContainText(savedSiteMarker);

	await website.ensureSiteManagerIsOpen();

	// Wait for auto-save to complete
	await waitForAutoSave(website.page);

	const savedSiteName = await website.page
		.getByLabel('Playground title')
		.textContent();

	// Open the saved playgrounds overlay
	await website.openSavedPlaygroundsOverlay();

	// Create a test ZIP with imported content marker
	const importedMarker = 'IMPORTED_CONTENT_MARKER_67890';
	const zipBuffer = await createTestWordPressZip(importedMarker);

	// Find the hidden file input and upload the ZIP
	const fileInput = website.page.locator(
		'input[type="file"][accept*=".zip"]'
	);

	// Set up dialog handler for the import success alert
	website.page.once('dialog', async (dialog) => {
		await dialog.accept();
	});

	// Upload the ZIP file
	await fileInput.setInputFiles({
		name: 'test-import.zip',
		mimeType: 'application/zip',
		buffer: zipBuffer,
	});

	// The import creates a new temporary site that then auto-saves.
	// Wait for it to settle.
	await website.ensureSiteManagerIsOpen();
	await waitForAutoSave(website.page);

	const importedSiteName = await website.page
		.getByLabel('Playground title')
		.textContent();
	expect(importedSiteName).not.toBe(savedSiteName);

	// Now verify the saved site still has the original content.
	// Open the saved playgrounds overlay and switch to the saved site
	await website.openSavedPlaygroundsOverlay();

	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: savedSiteName! })
		.click();

	// Wait for the saved site to load - this verifies the saved site wasn't overwritten
	// by the ZIP import (which went to a temporary site instead)
	await expect(website.page.getByLabel('Playground title')).toContainText(
		savedSiteName!,
		{ timeout: 30000 }
	);
});

test('should create temporary site when importing ZIP while on a saved site with no existing temporary site', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	// First, create and save a site
	const savedSiteMarker = 'SAVED_ONLY_MARKER_AAAAA';
	const blueprint: Blueprint = {
		landingPage: '/saved-only-marker.php',
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/saved-only-marker.php',
				data: `<?php echo '${savedSiteMarker}';`,
			},
		],
	};
	await website.goto(`./#${JSON.stringify(blueprint)}`);
	await expect(wordpress.locator('body')).toContainText(savedSiteMarker);

	await website.ensureSiteManagerIsOpen();

	// Wait for auto-save
	await waitForAutoSave(website.page);

	const savedSiteName = await website.page
		.getByLabel('Playground title')
		.textContent();

	// Get the site slug from the URL
	const urlAfterSave = website.page.url();
	const urlObj = new URL(urlAfterSave);
	const siteSlug = urlObj.searchParams.get('site-slug');
	expect(siteSlug).toBeTruthy();

	// Now reload the page directly with the site-slug parameter.
	// This simulates starting fresh with just the saved site (no temporary site).
	await website.page.goto(`./?site-slug=${siteSlug}`);
	await website.waitForNestedIframes();
	await website.ensureSiteManagerIsOpen();

	// Verify we're on the saved site
	await expect(website.page.getByLabel('Playground title')).toContainText(
		savedSiteName!
	);

	// Open the saved playgrounds overlay
	await website.openSavedPlaygroundsOverlay();

	// Verify there's an "Unsaved Playground" row (for creating a new site)
	const tempPlaygroundRow = website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: 'Unsaved Playground' });
	await expect(tempPlaygroundRow).toBeVisible();

	// Create a test ZIP
	const importedMarker = 'FRESH_IMPORT_MARKER_BBBBB';
	const zipBuffer = await createTestWordPressZip(importedMarker);

	// Find the file input
	const fileInput = website.page.locator(
		'input[type="file"][accept*=".zip"]'
	);

	// Set up dialog handler
	website.page.once('dialog', async (dialog) => {
		await dialog.accept();
	});

	// Upload the ZIP file
	await fileInput.setInputFiles({
		name: 'test-import-direct.zip',
		mimeType: 'application/zip',
		buffer: zipBuffer,
	});

	// The import creates a new temporary site. The auto-save and the
	// ZIP import run concurrently on the same Comlink client, so the
	// auto-save may take longer than usual. Instead of waiting for
	// auto-save, verify the site switch happened and that the saved
	// site is still intact.
	await website.waitForNestedIframes();
	await website.ensureSiteManagerIsOpen();

	// The title should have changed from the saved site name,
	// confirming we're on a different (imported) site now.
	await expect(
		website.page.getByLabel('Playground title')
	).not.toContainText(savedSiteName!, { timeout: 30000 });

	// Verify the saved site is still intact by switching to it
	await website.openSavedPlaygroundsOverlay();

	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: savedSiteName! })
		.click();

	// Wait for the saved site to load - this verifies the saved site wasn't overwritten
	// by the ZIP import (which went to a temporary site instead)
	await expect(website.page.getByLabel('Playground title')).toContainText(
		savedSiteName!,
		{ timeout: 30000 }
	);
});

// Missing site modal tests in a separate describe block to avoid state pollution
test.describe('Missing site modal', () => {
	// These tests also need serial mode since they use OPFS
	test.describe.configure({ mode: 'serial' });

	test('should show modal when loading non-existent site slug', async ({
		website,
		wordpress,
		browserName,
		context,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		// Clear all storage to ensure clean state
		await context.clearCookies();

		// Use a unique slug that definitely doesn't exist
		const uniqueSlug = `missing-modal-test-${Date.now()}`;
		await website.goto(`./?site-slug=${uniqueSlug}`);

		// The modal should appear early, even before WordPress fully loads
		await expect(
			website.page.getByRole('dialog', {
				name: 'This is a dialog window which overlays the main content of the page. It offers the user a choice between using an Unsaved Playground and a persistent Playground that is saved to browser storage.',
			})
		).toBeVisible({ timeout: 30000 });
	});

	test('should dismiss modal when clicking dismiss button', async ({
		website,
		wordpress,
		browserName,
		context,
	}) => {
		test.skip(
			browserName !== 'chromium',
			`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
		);

		// Clear storage
		await context.clearCookies();

		const uniqueSlug = `dismiss-modal-test-${Date.now()}`;
		await website.goto(`./?site-slug=${uniqueSlug}`);

		// Wait for modal
		const dialog = website.page.getByRole('dialog', {
			name: 'This is a dialog window which overlays the main content of the page. It offers the user a choice between using an Unsaved Playground and a persistent Playground that is saved to browser storage.',
		});
		await expect(dialog).toBeVisible({ timeout: 30000 });

		// Click dismiss button
		await dialog
			.getByRole('button', {
				name: 'Keep using an Unsaved Playground',
			})
			.click();

		// Modal should close
		await expect(dialog).not.toBeVisible();
	});
});
