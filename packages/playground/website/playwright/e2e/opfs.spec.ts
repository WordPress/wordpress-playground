import { test, expect } from '../playground-fixtures.ts';
import type { Blueprint } from '@wp-playground/blueprints';
import type { Page } from '@playwright/test';

/**
 * Creates a minimal WordPress export ZIP file for testing imports.
 * The ZIP contains just an index.php file with the given marker content.
 *
 * This is a pre-built minimal ZIP structure created with the following layout:
 * /wp-content/
 *   index.php -> "<?php echo 'IMPORTED_MARKER';"
 *
 * The ZIP is created using standard ZIP format with no compression (store method).
 */
function createTestWordPressZip(markerContent: string): Buffer {
	// Create a simple PHP file content
	const phpContent = `<?php echo '${markerContent}';`;
	const phpBytes = Buffer.from(phpContent, 'utf-8');

	// File path in the ZIP
	const filePath = 'wp-content/index.php';
	const filePathBytes = Buffer.from(filePath, 'utf-8');

	// Current date/time for DOS format
	const now = new Date();
	const dosTime =
		(now.getSeconds() >> 1) |
		(now.getMinutes() << 5) |
		(now.getHours() << 11);
	const dosDate =
		now.getDate() |
		((now.getMonth() + 1) << 5) |
		((now.getFullYear() - 1980) << 9);

	// Calculate CRC32 for the content
	const crc32 = calculateCrc32(phpBytes);

	// Build the ZIP file structure
	const localFileHeader = Buffer.alloc(30 + filePathBytes.length);
	let offset = 0;

	// Local file header signature
	localFileHeader.writeUInt32LE(0x04034b50, offset);
	offset += 4;
	// Version needed to extract
	localFileHeader.writeUInt16LE(20, offset);
	offset += 2;
	// General purpose bit flag
	localFileHeader.writeUInt16LE(0, offset);
	offset += 2;
	// Compression method (0 = stored)
	localFileHeader.writeUInt16LE(0, offset);
	offset += 2;
	// Last mod file time
	localFileHeader.writeUInt16LE(dosTime, offset);
	offset += 2;
	// Last mod file date
	localFileHeader.writeUInt16LE(dosDate, offset);
	offset += 2;
	// CRC-32
	localFileHeader.writeUInt32LE(crc32, offset);
	offset += 4;
	// Compressed size
	localFileHeader.writeUInt32LE(phpBytes.length, offset);
	offset += 4;
	// Uncompressed size
	localFileHeader.writeUInt32LE(phpBytes.length, offset);
	offset += 4;
	// File name length
	localFileHeader.writeUInt16LE(filePathBytes.length, offset);
	offset += 2;
	// Extra field length
	localFileHeader.writeUInt16LE(0, offset);
	offset += 2;
	// File name
	filePathBytes.copy(localFileHeader, offset);

	// Central directory file header
	const centralDirHeader = Buffer.alloc(46 + filePathBytes.length);
	offset = 0;

	// Central file header signature
	centralDirHeader.writeUInt32LE(0x02014b50, offset);
	offset += 4;
	// Version made by
	centralDirHeader.writeUInt16LE(20, offset);
	offset += 2;
	// Version needed to extract
	centralDirHeader.writeUInt16LE(20, offset);
	offset += 2;
	// General purpose bit flag
	centralDirHeader.writeUInt16LE(0, offset);
	offset += 2;
	// Compression method
	centralDirHeader.writeUInt16LE(0, offset);
	offset += 2;
	// Last mod file time
	centralDirHeader.writeUInt16LE(dosTime, offset);
	offset += 2;
	// Last mod file date
	centralDirHeader.writeUInt16LE(dosDate, offset);
	offset += 2;
	// CRC-32
	centralDirHeader.writeUInt32LE(crc32, offset);
	offset += 4;
	// Compressed size
	centralDirHeader.writeUInt32LE(phpBytes.length, offset);
	offset += 4;
	// Uncompressed size
	centralDirHeader.writeUInt32LE(phpBytes.length, offset);
	offset += 4;
	// File name length
	centralDirHeader.writeUInt16LE(filePathBytes.length, offset);
	offset += 2;
	// Extra field length
	centralDirHeader.writeUInt16LE(0, offset);
	offset += 2;
	// File comment length
	centralDirHeader.writeUInt16LE(0, offset);
	offset += 2;
	// Disk number start
	centralDirHeader.writeUInt16LE(0, offset);
	offset += 2;
	// Internal file attributes
	centralDirHeader.writeUInt16LE(0, offset);
	offset += 2;
	// External file attributes
	centralDirHeader.writeUInt32LE(0, offset);
	offset += 4;
	// Relative offset of local header
	centralDirHeader.writeUInt32LE(0, offset);
	offset += 4;
	// File name
	filePathBytes.copy(centralDirHeader, offset);

	// End of central directory record
	const centralDirOffset = localFileHeader.length + phpBytes.length;
	const centralDirSize = centralDirHeader.length;

	const endOfCentralDir = Buffer.alloc(22);
	offset = 0;

	// End of central dir signature
	endOfCentralDir.writeUInt32LE(0x06054b50, offset);
	offset += 4;
	// Number of this disk
	endOfCentralDir.writeUInt16LE(0, offset);
	offset += 2;
	// Disk where central directory starts
	endOfCentralDir.writeUInt16LE(0, offset);
	offset += 2;
	// Number of central directory records on this disk
	endOfCentralDir.writeUInt16LE(1, offset);
	offset += 2;
	// Total number of central directory records
	endOfCentralDir.writeUInt16LE(1, offset);
	offset += 2;
	// Size of central directory
	endOfCentralDir.writeUInt32LE(centralDirSize, offset);
	offset += 4;
	// Offset of start of central directory
	endOfCentralDir.writeUInt32LE(centralDirOffset, offset);
	offset += 4;
	// Comment length
	endOfCentralDir.writeUInt16LE(0, offset);

	return Buffer.concat([
		localFileHeader,
		phpBytes,
		centralDirHeader,
		endOfCentralDir,
	]);
}

/**
 * Simple CRC32 implementation for ZIP file creation
 */
function calculateCrc32(buffer: Buffer): number {
	let crc = 0xffffffff;
	const table = getCrc32Table();
	for (let i = 0; i < buffer.length; i++) {
		crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xff];
	}
	return (crc ^ 0xffffffff) >>> 0;
}

let crc32Table: number[] | null = null;
function getCrc32Table(): number[] {
	if (crc32Table) return crc32Table;
	crc32Table = [];
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let j = 0; j < 8; j++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		crc32Table[i] = c;
	}
	return crc32Table;
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

	// Click the Save button to open the modal
	await expect(page.getByText('Save').first()).toBeEnabled();
	await page.getByText('Save').first().click();

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

	// Wait for the dialog to close
	await expect(dialog).not.toBeVisible({ timeout: 10000 });
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
		'Temporary Playground',
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
		.filter({ hasText: 'Temporary Playground' })
		.click();

	// The overlay closes and site manager opens with the selected site
	await expect(website.page.getByLabel('Playground title')).toContainText(
		'Temporary Playground'
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
		'Temporary Playground',
		{
			// Saving the site takes a while on CI
			timeout: 90000,
		}
	);

	const storedPlaygroundTitleText = await website.page
		.getByLabel('Playground title')
		.textContent();
	await expect(storedPlaygroundTitleText).not.toBeNull();
	await expect(storedPlaygroundTitleText).not.toMatch('Temporary Playground');

	// Open the saved playgrounds overlay to switch sites
	await website.openSavedPlaygroundsOverlay();

	// Switch to Temporary Playground
	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: 'Temporary Playground' })
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
		'Temporary Playground',
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

	// Click the Save button
	await expect(website.page.getByText('Save').first()).toBeEnabled();
	await website.page.getByText('Save').first().click();

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
	await website.page.getByText('Save').first().click();
	const dialog = website.page.getByRole('dialog', {
		name: 'Save Playground',
	});
	await expect(dialog).toBeVisible({ timeout: 10000 });

	// Close without saving using Cancel button
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog).not.toBeVisible();

	// Verify the site is still temporary
	await expect(website.page.getByLabel('Playground title')).toContainText(
		'Temporary Playground'
	);

	// Open the modal again
	await website.page.getByText('Save').first().click();
	await expect(dialog).toBeVisible({ timeout: 10000 });

	// Close using ESC key
	await website.page.keyboard.press('Escape');
	await expect(dialog).not.toBeVisible();

	// Verify the site is still temporary
	await expect(website.page.getByLabel('Playground title')).toContainText(
		'Temporary Playground'
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
	await website.page.getByText('Save').first().click();
	const dialog = website.page.getByRole('dialog', {
		name: 'Save Playground',
	});
	await expect(dialog).toBeVisible({ timeout: 10000 });

	const nameInput = dialog.getByLabel('Playground name');

	// Verify the input is focused and text is selected
	await expect(nameInput).toBeFocused();

	// Type without selecting - it should replace the selected text
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
	await website.page.getByText('Save').first().click();
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
	await website.page.getByText('Save').first().click();
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
	const zipBuffer = createTestWordPressZip(importedMarker);

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
		'Temporary Playground',
		{ timeout: 30000 }
	);

	// Now verify the saved site still has the original content.
	// Open the saved playgrounds overlay and switch to the saved site
	await website.openSavedPlaygroundsOverlay();

	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: savedSiteName })
		.click();

	// Wait for the saved site to load
	await expect(website.page.getByLabel('Playground title')).toContainText(
		savedSiteName,
		{ timeout: 30000 }
	);

	// Navigate to the test marker page and verify the original content is intact
	await website.wordpress().locator('body').waitFor();

	// Use the playground to navigate to our test page
	const playgroundViewport = website.page.frameLocator(
		'#playground-viewport:visible,.playground-viewport:visible'
	);
	await playgroundViewport
		.locator('#wp')
		.evaluate((iframe: HTMLIFrameElement) => {
			iframe.contentWindow!.location.href = '/test-marker.php';
		});

	// Verify the saved site still has the original marker (not the imported content)
	await expect(wordpress.locator('body')).toContainText(savedSiteMarker, {
		timeout: 10000,
	});
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
		.filter({ hasText: 'Temporary Playground' });

	// The row exists but it's for creating a new temporary playground
	await expect(tempPlaygroundRow).toBeVisible();

	// Create a test ZIP
	const importedMarker = 'FRESH_IMPORT_MARKER_BBBBB';
	const zipBuffer = createTestWordPressZip(importedMarker);

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
		'Temporary Playground',
		{ timeout: 30000 }
	);

	// Verify the saved site is still intact by switching to it
	await website.openSavedPlaygroundsOverlay();

	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: savedSiteName })
		.click();

	await expect(website.page.getByLabel('Playground title')).toContainText(
		savedSiteName,
		{ timeout: 30000 }
	);
});
