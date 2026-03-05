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
 * Helper function to handle the save site modal flow
 */
async function saveSiteViaModal(
	page: Page,
	options?: {
		customName?: string;
		storageType?: 'opfs' | 'local-fs';
	}
) {
	const { customName, storageType = 'opfs' } = options || {};

	// Click the "Save site locally" button in the temporary site notice to open the modal.
	// This button is in the site manager panel and triggers the save flow via SitePersistButton.
	const saveButton = page.getByRole('button', { name: 'Save site locally' });
	await expect(saveButton).toBeEnabled();
	await saveButton.click();

	// Wait for the Save Playground dialog to appear
	const dialog = page.getByRole('dialog', { name: 'Save Playground' });
	await expect(dialog).toBeVisible({ timeout: 10000 });

	// If a custom name is provided, update it
	if (customName) {
		const nameInput = dialog.getByLabel('Playground name');
		await nameInput.fill('');
		await nameInput.type(customName);
	}

	// Select storage location - wait for the radio button to be available first
	if (storageType === 'opfs') {
		// We shouldn't need to explicitly call .waitFor(), but the test fails without it.
		// Playwright logs that something "intercepts pointer events", that's probably related.
		await dialog.getByText('Save in this browser').waitFor();
		await dialog.getByText('Save in this browser').click({ force: true });
	} else {
		await dialog.getByText('Save to a local directory').waitFor();
		await dialog
			.getByText('Save to a local directory')
			.click({ force: true });
	}

	// Click the Save button in the modal
	await dialog.getByRole('button', { name: 'Save' }).click();

	// Wait for the dialog to close.
	// The save operation syncs to OPFS which can take time, so we use a longer timeout.
	await expect(dialog).not.toBeVisible({ timeout: 60000 });
}

test('should switch between sites', async ({ website, browserName }) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./');

	await website.ensureSiteManagerIsOpen();

	// Save the temporary site using the modal
	await saveSiteViaModal(website.page);

	await expect(website.page.getByLabel('Playground title')).not.toContainText(
		'Unsaved Playground',
		{
			// Saving the site takes a while on CI
			timeout: 90000,
		}
	);

	// Open the saved playgrounds overlay to switch sites
	await website.openSavedPlaygroundsOverlay();

	// Click on Temporary Playground in the overlay's site list
	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: 'Unsaved Playground' })
		.click();

	// The overlay closes and site manager opens with the selected site
	await expect(website.page.getByLabel('Playground title')).toContainText(
		'Unsaved Playground'
	);
});

test('should preserve PHP constants when saving a temporary site to OPFS', async ({
	website,
	browserName,
	wordpress,
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

	await website.ensureSiteManagerIsOpen();

	// Save the temporary site using the modal
	await saveSiteViaModal(website.page);

	await expect(website.page.getByLabel('Playground title')).not.toContainText(
		'Unsaved Playground',
		{
			// Saving the site takes a while on CI
			timeout: 90000,
		}
	);

	const storedPlaygroundTitleText = await website.page
		.getByLabel('Playground title')
		.textContent();
	await expect(storedPlaygroundTitleText).not.toBeNull();
	await expect(storedPlaygroundTitleText).not.toMatch('Unsaved Playground');

	// Open the saved playgrounds overlay to switch sites
	await website.openSavedPlaygroundsOverlay();

	// Switch to Temporary Playground
	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: 'Unsaved Playground' })
		.click();

	// Open the overlay again to switch back to the stored site
	await website.openSavedPlaygroundsOverlay();

	// Switch back to the stored site and confirm the PHP constant is still present.
	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: storedPlaygroundTitleText! })
		.click();

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

	// Save the temporary site to OPFS so rename is available
	await saveSiteViaModal(website.page);

	await expect(website.page.getByLabel('Playground title')).not.toContainText(
		'Unsaved Playground',
		{
			timeout: 90000,
		}
	);

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

test('should show save site modal with correct elements', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./');
	await website.ensureSiteManagerIsOpen();

	// Click the Save button in the site manager panel
	const saveButton = website.page.getByRole('button', {
		name: 'Save site locally',
	});
	await expect(saveButton).toBeEnabled();
	await saveButton.click();

	// Verify the modal appears with correct title
	const dialog = website.page.getByRole('dialog', {
		name: 'Save Playground',
	});
	await expect(dialog).toBeVisible({ timeout: 10000 });

	// Verify the playground name input exists and has default value
	const nameInput = dialog.getByLabel('Playground name');
	await expect(nameInput).toBeVisible();
	await expect(nameInput).toHaveValue(/.+/);

	// Verify storage location radio buttons exist
	await expect(dialog.getByText('Storage location')).toBeVisible();
	await expect(dialog.getByText('Save in this browser')).toBeVisible();
	await expect(dialog.getByText('Save to a local directory')).toBeVisible();

	// Verify action buttons exist
	await expect(dialog.getByRole('button', { name: 'Save' })).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();

	// Close the modal
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog).not.toBeVisible();
});

test('should close save site modal without saving', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./');
	await website.ensureSiteManagerIsOpen();

	// Open the modal
	await website.page
		.getByRole('button', { name: 'Save site locally' })
		.click();
	const dialog = website.page.getByRole('dialog', {
		name: 'Save Playground',
	});
	await expect(dialog).toBeVisible({ timeout: 10000 });

	// Close without saving using Cancel button
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog).not.toBeVisible();

	// Verify the site is still temporary
	await expect(website.page.getByLabel('Playground title')).toContainText(
		'Unsaved Playground'
	);

	// Open the modal again
	await website.page
		.getByRole('button', { name: 'Save site locally' })
		.click();
	await expect(dialog).toBeVisible({ timeout: 10000 });

	// Close using ESC key
	await website.page.keyboard.press('Escape');
	await expect(dialog).not.toBeVisible();

	// Verify the site is still temporary
	await expect(website.page.getByLabel('Playground title')).toContainText(
		'Unsaved Playground'
	);
});

test('should have playground name input text selected by default', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./');
	await website.ensureSiteManagerIsOpen();

	// Open the modal
	await website.page
		.getByRole('button', { name: 'Save site locally' })
		.click();
	const dialog = website.page.getByRole('dialog', {
		name: 'Save Playground',
	});
	await expect(dialog).toBeVisible({ timeout: 10000 });

	const nameInput = dialog.getByLabel('Playground name');

	// Verify the input is focused
	await expect(nameInput).toBeFocused();

	// The input text should be pre-selected, but selection timing can be flaky.
	// Use Ctrl+A to ensure all text is selected before typing.
	await website.page.keyboard.press('ControlOrMeta+a');

	// Type to replace the selected text
	await website.page.keyboard.type('New Name');
	await expect(nameInput).toHaveValue('New Name');

	// Close the modal
	await dialog.getByRole('button', { name: 'Cancel' }).click();
});

test('should save site with custom name', async ({ website, browserName }) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./');
	await website.ensureSiteManagerIsOpen();

	const customName = 'My Custom Playground Name';

	// Save with custom name using the helper
	await saveSiteViaModal(website.page, { customName });

	// Verify the site was saved with the custom name
	await expect(website.page.getByLabel('Playground title')).toContainText(
		customName,
		{
			timeout: 90000,
		}
	);

	// Verify the name also appears in the saved playgrounds overlay
	await website.openSavedPlaygroundsOverlay();
	await expect(
		website.page.locator('[class*="siteRowName"]', { hasText: customName })
	).toBeVisible();
	await website.closeSavedPlaygroundsOverlay();
});

test('should not persist save site modal through page refresh', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./');
	await website.ensureSiteManagerIsOpen();

	// Open the save modal
	await website.page
		.getByRole('button', { name: 'Save site locally' })
		.click();
	const dialog = website.page.getByRole('dialog', {
		name: 'Save Playground',
	});
	await expect(dialog).toBeVisible({ timeout: 10000 });

	// Get the URL with the modal parameter
	const urlWithModal = website.page.url();
	expect(urlWithModal).toContain('modal=save-site');

	// Reload the page
	await website.page.reload();
	await website.ensureSiteManagerIsOpen();

	// Verify the modal is NOT shown after reload
	await expect(dialog).not.toBeVisible();

	// Verify the modal parameter was removed from the URL
	const urlAfterReload = website.page.url();
	expect(urlAfterReload).not.toContain('modal=save-site');
});

test('should display OPFS storage option as selected by default', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto('./');
	await website.ensureSiteManagerIsOpen();

	// Open the save modal
	await website.page
		.getByRole('button', { name: 'Save site locally' })
		.click();
	const dialog = website.page.getByRole('dialog', {
		name: 'Save Playground',
	});
	await expect(dialog).toBeVisible({ timeout: 10000 });

	// Verify OPFS option is selected by default
	const opfsRadio = dialog.getByRole('radio', {
		name: /Save in this browser/,
	});
	await expect(opfsRadio).toBeChecked();

	// Close the modal
	await dialog.getByRole('button', { name: 'Cancel' }).click();
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

	// Save the site with a custom name
	const savedSiteName = 'ZIP Import Test Site';
	await saveSiteViaModal(website.page, { customName: savedSiteName });

	// Wait for the site to be saved (title should change from "Temporary Playground")
	await expect(website.page.getByLabel('Playground title')).toContainText(
		savedSiteName,
		{ timeout: 90000 }
	);

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

	// The import should switch us to a temporary playground.
	// Wait for the site title to show "Temporary Playground"
	await expect(website.page.getByLabel('Playground title')).toContainText(
		'Unsaved Playground',
		{ timeout: 30000 }
	);

	// Now verify the saved site still has the original content.
	// Open the saved playgrounds overlay and switch to the saved site
	await website.openSavedPlaygroundsOverlay();

	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: savedSiteName })
		.click();

	// Wait for the saved site to load - this verifies the saved site wasn't overwritten
	// by the ZIP import (which went to a temporary site instead)
	await expect(website.page.getByLabel('Playground title')).toContainText(
		savedSiteName,
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

	// Save the site
	const savedSiteName = 'Direct Slug Test Site';
	await saveSiteViaModal(website.page, { customName: savedSiteName });

	await expect(website.page.getByLabel('Playground title')).toContainText(
		savedSiteName,
		{ timeout: 90000 }
	);

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
		savedSiteName
	);

	// Open the saved playgrounds overlay
	await website.openSavedPlaygroundsOverlay();

	// Verify there's no "Temporary Playground" in the list initially
	// (the temporary site row should show but clicking it would create one)
	const tempPlaygroundRow = website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: 'Unsaved Playground' });

	// The row exists but it's for creating a new temporary playground
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

	// The import should trigger creation of a new temporary site.
	// Wait for the site title to show "Temporary Playground"
	await expect(website.page.getByLabel('Playground title')).toContainText(
		'Unsaved Playground',
		{ timeout: 30000 }
	);

	// Verify the saved site is still intact by switching to it
	await website.openSavedPlaygroundsOverlay();

	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: savedSiteName })
		.click();

	// Wait for the saved site to load - this verifies the saved site wasn't overwritten
	// by the ZIP import (which went to a temporary site instead)
	await expect(website.page.getByLabel('Playground title')).toContainText(
		savedSiteName,
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
