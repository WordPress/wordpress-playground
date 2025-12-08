import { test, expect } from '../playground-fixtures.ts';
import type { Blueprint } from '@wp-playground/blueprints';
import type { Page } from '@playwright/test';

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
