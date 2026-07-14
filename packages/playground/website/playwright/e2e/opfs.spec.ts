import { test, expect } from '../playground-fixtures.ts';
import type { Blueprint } from '@wp-playground/blueprints';
import type { BrowserContext, Page } from '@playwright/test';
import { encodeZip, collectBytes } from '@php-wasm/stream-compression';
import { getDirectoryNameForSlug } from '../../src/lib/state/opfs/opfs-site-path';

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

async function createPluginThemeExportZip(): Promise<Buffer> {
	const files = [
		new File(
			[
				`<?php
/**
 * Plugin Name: Close Race Plugin
 */
`,
			],
			'wp-content/plugins/close-race-plugin/close-race-plugin.php'
		),
		new File(
			[
				`/*
Theme Name: Close Race Theme
*/
`,
			],
			'wp-content/themes/close-race-theme/style.css'
		),
		new File(
			[`<?php echo 'Close Race Theme';`],
			'wp-content/themes/close-race-theme/index.php'
		),
	];
	const zipStream = encodeZip(files);
	const zipBytes = await collectBytes(zipStream);
	return Buffer.from(zipBytes!);
}

// OPFS tests must run serially because OPFS storage is shared at the browser
// level, so tests would interfere with each other's saved sites if run in parallel.
test.describe.configure({ mode: 'serial' });

/**
 * Returns a URL that opts this test out of default browser storage.
 *
 * `storage=temp` is what makes the site temporary. The random value keeps
 * repeated navigations from reusing a temporary site created earlier in this
 * serial OPFS test file.
 */
function getTemporaryPlaygroundUrl(hash = '') {
	return `./?storage=temp&random=${Math.random().toString(36).slice(2)}${hash}`;
}

const OPFS_CLEANUP_LOCK_HOLDER_KEY = 'simulate-opfs-cleanup-lock-holder';
const OPFS_CLEANUP_FAILURE_COUNT_KEY = 'opfs-cleanup-failure-count';

/**
 * Makes OPFS file removal fail while another test tab is marked as open.
 *
 * Chromium does not give us a reliable way to force a real OPFS lock in CI.
 * This patch creates the same kind of failure the boot code sees: removing an
 * old file rejects until the other tab closes. Closing the holder tab removes
 * the marker through `beforeunload`/`pagehide`, so the next retry can succeed.
 */
async function simulateOpfsCleanupBlockedByAnotherTab(context: BrowserContext) {
	await context.addInitScript(
		({ lockHolderKey, failureCountKey }) => {
			const tabId = `${Date.now()}-${Math.random()}`;
			const releaseLockForThisTab = () => {
				if (localStorage.getItem(lockHolderKey) === tabId) {
					localStorage.removeItem(lockHolderKey);
				}
			};
			(window as any).simulateOpfsCleanupLockForThisTab = () => {
				localStorage.setItem(lockHolderKey, tabId);
				localStorage.removeItem(failureCountKey);
			};
			window.addEventListener('beforeunload', releaseLockForThisTab);
			window.addEventListener('pagehide', releaseLockForThisTab);

			const originalRemoveEntry =
				FileSystemDirectoryHandle.prototype.removeEntry;
			FileSystemDirectoryHandle.prototype.removeEntry =
				function removeEntry(name, options) {
					const lockHolder = localStorage.getItem(lockHolderKey);
					if (
						lockHolder &&
						lockHolder !== tabId &&
						name !== 'wp-runtime.json' &&
						name !== 'blueprint'
					) {
						const failureCount = Number(
							localStorage.getItem(failureCountKey) || '0'
						);
						localStorage.setItem(
							failureCountKey,
							String(failureCount + 1)
						);
						return Promise.reject(
							new DOMException(
								`Simulated OPFS cleanup lock for ${name}`,
								'InvalidStateError'
							)
						);
					}
					return originalRemoveEntry.call(this, name, options);
				};
		},
		{
			lockHolderKey: OPFS_CLEANUP_LOCK_HOLDER_KEY,
			failureCountKey: OPFS_CLEANUP_FAILURE_COUNT_KEY,
		}
	);
}

/**
 * Writes the OPFS state left by an interrupted saved Playground reset.
 *
 * `wp-runtime.json` already asks for the new setup, but old WordPress files
 * still sit next to it because the tab closed before cleanup finished.
 */
async function writePendingOpfsResetSite(page: Page, slug: string) {
	await page.evaluate(
		async ({ dirName, siteSlug }) => {
			const root = await navigator.storage.getDirectory();
			try {
				await root.removeEntry('sites', { recursive: true });
			} catch (error) {
				if (error?.name !== 'NotFoundError') {
					throw error;
				}
			}
			const sites = await root.getDirectoryHandle('sites', {
				create: true,
			});
			const siteDirectory = await sites.getDirectoryHandle(dirName, {
				create: true,
			});
			const metadata = {
				slug: siteSlug,
				originalUrlParams: undefined,
				originalBlueprintSource: { type: 'none' },
				originalBlueprint: {
					preferredVersions: { php: '8.4', wp: false },
					landingPage: '/index.php',
					steps: [
						{
							step: 'writeFile',
							path: '/wordpress/index.php',
							data: '<?php echo "cleanup retry ready";',
						},
					],
				},
				name: siteSlug,
				id: siteSlug,
				whenCreated: Date.now(),
				whenLastUsed: Date.now(),
				persistence: 'autosave',
				storage: 'opfs',
				initialOpfsSyncPending: true,
				opfsSiteRemovalPending: true,
				sourceSetupUrlFingerprint: `test-${siteSlug}`,
				runtimeConfiguration: {
					phpVersion: '8.4',
					wpVersion: 'latest',
					intl: false,
					networking: true,
					extraLibraries: [],
					constants: {},
				},
			};
			await writeFile(
				siteDirectory,
				'wp-runtime.json',
				JSON.stringify(metadata, null, 2)
			);
			await writeFile(
				siteDirectory,
				'wp-config.php',
				'<?php /* old config */'
			);
			await writeFile(
				siteDirectory,
				'wp-settings.php',
				'<?php /* old settings */'
			);
			await writeFile(
				siteDirectory,
				'old-reset-sentinel.php',
				'old site'
			);
			const wpContent = await siteDirectory.getDirectoryHandle(
				'wp-content',
				{ create: true }
			);
			const database = await wpContent.getDirectoryHandle('database', {
				create: true,
			});
			await writeFile(database, '.ht.sqlite', 'old sqlite placeholder');

			async function writeFile(
				directory: FileSystemDirectoryHandle,
				name: string,
				contents: string
			) {
				const file = await directory.getFileHandle(name, {
					create: true,
				});
				const writable = await file.createWritable();
				await writable.write(contents);
				await writable.close();
			}
		},
		{ dirName: getDirectoryNameForSlug(slug), siteSlug: slug }
	);
}

async function readPendingResetSiteState(page: Page, slug: string) {
	return await page.evaluate(
		async ({ dirName }) => {
			const root = await navigator.storage.getDirectory();
			const sites = await root.getDirectoryHandle('sites');
			const siteDirectory = await sites.getDirectoryHandle(dirName);
			const metadataFile =
				await siteDirectory.getFileHandle('wp-runtime.json');
			const metadata = JSON.parse(
				await (await metadataFile.getFile()).text()
			);
			const hasEntry = async (name: string) => {
				try {
					await siteDirectory.getFileHandle(name);
					return true;
				} catch (error) {
					if (error?.name === 'NotFoundError') {
						return false;
					}
					throw error;
				}
			};
			return {
				metadata,
				hasOldResetSentinel: await hasEntry('old-reset-sentinel.php'),
			};
		},
		{ dirName: getDirectoryNameForSlug(slug) }
	);
}

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

	// The site manager remembers the last selected tab. The save notice only
	// lives on the Settings tab, so select it before looking for the button.
	await page.getByRole('tab', { name: 'Settings' }).click();

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

test('should retry pending OPFS cleanup after another tab releases storage', async ({
	website,
	context,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await simulateOpfsCleanupBlockedByAnotherTab(context);
	const slug = `pending-cleanup-${Date.now()}`;
	await website.page.goto(getTemporaryPlaygroundUrl());
	await website.page.waitForFunction(() => !!navigator.storage?.getDirectory);
	await writePendingOpfsResetSite(website.page, slug);

	const lockPage = await context.newPage();
	await lockPage.goto(getTemporaryPlaygroundUrl());
	await lockPage.evaluate(() => {
		(window as any).simulateOpfsCleanupLockForThisTab();
	});

	await website.page.goto(
		`./?site-slug=${encodeURIComponent(slug)}&random=${Date.now()}`
	);
	await expect
		.poll(() =>
			website.page.evaluate(
				(failureCountKey) =>
					Number(localStorage.getItem(failureCountKey) || '0'),
				OPFS_CLEANUP_FAILURE_COUNT_KEY
			)
		)
		.toBeGreaterThan(0);

	// This mirrors the user closing another Playground tab that still holds on
	// to the old OPFS files. The next automatic retry should finish cleanup and boot.
	await lockPage.close({ runBeforeUnload: true });
	await expect
		.poll(() =>
			website.page.evaluate(
				(lockHolderKey) => localStorage.getItem(lockHolderKey),
				OPFS_CLEANUP_LOCK_HOLDER_KEY
			)
		)
		.toBeNull();

	await expect(website.wordpress().locator('body')).toContainText(
		'cleanup retry ready',
		{ timeout: 120000 }
	);
	await expect(
		website.page.getByText('Close other Playground tabs, then reload')
	).not.toBeVisible();

	const storedSite = await readPendingResetSiteState(website.page, slug);
	expect(storedSite.metadata.opfsSiteRemovalPending).toBeUndefined();
	expect(storedSite.hasOldResetSentinel).toBe(false);
});

test('should switch between sites', async ({ website, browserName }) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto(getTemporaryPlaygroundUrl());

	await website.ensureSiteManagerIsOpen();

	// Save the temporary site using the modal
	const firstSiteName = 'Switching Test Site';
	await saveSiteViaModal(website.page, { customName: firstSiteName });

	await expect(website.page.getByLabel('Playground title')).not.toContainText(
		'Unsaved Playground',
		{
			// Saving the site takes a while on CI
			timeout: 90000,
		}
	);
	await expect(website.page.getByLabel('Playground title')).toContainText(
		firstSiteName
	);

	// Open the saved playgrounds overlay to switch sites
	await website.openSavedPlaygroundsOverlay();

	// Start another saved Playground, then switch back to the first one.
	await website.page.getByRole('button', { name: 'New Playground' }).click();
	await website.waitForNestedIframes();
	await website.ensureSiteManagerIsOpen();

	await expect(website.page.getByLabel('Playground title')).not.toContainText(
		firstSiteName
	);
	await expect(
		website.page.getByText('Autosaved in this browser')
	).toBeVisible({ timeout: 120000 });
	await expect
		.poll(() =>
			website.page.evaluate(() => {
				const activeSite = (window as any).playgroundSites
					.list()
					.find((site: any) => site.isActive);
				return activeSite
					? `${activeSite.storage}:${activeSite.persistence}`
					: null;
			})
		)
		.toBe('opfs:autosave');

	await website.openSavedPlaygroundsOverlay();
	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: firstSiteName })
		.click();
	await website.ensureSiteManagerIsOpen();

	await expect(website.page.getByLabel('Playground title')).toContainText(
		firstSiteName
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
	await website.goto(
		getTemporaryPlaygroundUrl(`#${JSON.stringify(blueprint)}`)
	);

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

	// Create another Playground, then switch back.
	await website.page.getByRole('button', { name: 'New Playground' }).click();
	await website.waitForNestedIframes();

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

	await website.goto(getTemporaryPlaygroundUrl());
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

	await website.goto(getTemporaryPlaygroundUrl());
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

	await website.goto(getTemporaryPlaygroundUrl());
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

	await website.goto(getTemporaryPlaygroundUrl());
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

	await website.goto(getTemporaryPlaygroundUrl());
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

	await website.goto(getTemporaryPlaygroundUrl());
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

	await website.goto(getTemporaryPlaygroundUrl());
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

test('should flash import progress and finish after a close attempt during ZIP import', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto(getTemporaryPlaygroundUrl());
	await website.openSavedPlaygroundsOverlay();

	const zipBuffer = await createPluginThemeExportZip();
	const fileInput = website.page.locator(
		'input[type="file"][accept*=".zip"]'
	);
	const importComplete = website.page
		.waitForEvent('dialog')
		.then(async (dialog) => {
			await dialog.accept();
		});
	await fileInput.setInputFiles({
		name: 'playground-export-with-plugin-and-theme.zip',
		mimeType: 'application/zip',
		buffer: zipBuffer,
	});
	const zipStatus = website.page.getByTestId('zip-import-status');
	await expect(zipStatus).toBeVisible();
	const closeButton = website.page.getByRole('button', { name: 'Close' });
	await expect(closeButton).toBeEnabled();
	await closeButton.click();
	await expect(zipStatus).toBeVisible();
	await expect(zipStatus).toHaveClass(/zipImportStatusAttention/);
	await importComplete;

	await expect
		.poll(
			() =>
				website.page.evaluate(async () => {
					const playground = (
						window as any
					).playgroundSites.getClient();
					if (!playground) {
						return { plugin: false, theme: false };
					}
					const documentRoot = await playground.documentRoot;
					return {
						plugin: await playground.fileExists(
							`${documentRoot}/wp-content/plugins/close-race-plugin/close-race-plugin.php`
						),
						theme: await playground.fileExists(
							`${documentRoot}/wp-content/themes/close-race-theme/style.css`
						),
					};
				}),
			{ timeout: 90000 }
		)
		.toEqual({ plugin: true, theme: true });
});

test('should import ZIP into a new saved site when a saved site exists', async ({
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
	await website.goto(
		getTemporaryPlaygroundUrl(`#${JSON.stringify(blueprint)}`)
	);

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

	// The import should switch us to a new saved Playground by default.
	await expect(website.page.getByLabel('Playground title')).not.toContainText(
		savedSiteName,
		{ timeout: 30000 }
	);
	await expect(website.page.getByLabel('Playground title')).not.toContainText(
		'Unsaved Playground'
	);

	// Now verify the saved site still has the original content.
	// Open the saved playgrounds overlay and switch to the saved site
	await website.openSavedPlaygroundsOverlay();

	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: savedSiteName })
		.click();
	await website.ensureSiteManagerIsOpen();

	// Wait for the saved site to load - this verifies the saved site wasn't overwritten
	// by the ZIP import (which went to a new saved site instead)
	await expect(website.page.getByLabel('Playground title')).toContainText(
		savedSiteName,
		{ timeout: 30000 }
	);
});

test('should create a saved site when importing ZIP while on a saved site with no existing temporary site', async ({
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
	await website.goto(
		getTemporaryPlaygroundUrl(`#${JSON.stringify(blueprint)}`)
	);
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

	const importZipButton = website.page.getByRole('button', {
		name: 'Import a .zip',
	});
	await expect(importZipButton).toBeVisible();

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

	// The import should trigger creation of a new saved site by default.
	await expect(website.page.getByLabel('Playground title')).not.toContainText(
		savedSiteName,
		{ timeout: 30000 }
	);
	await expect(website.page.getByLabel('Playground title')).not.toContainText(
		'Unsaved Playground'
	);

	// Verify the saved site is still intact by switching to it
	await website.openSavedPlaygroundsOverlay();

	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: savedSiteName })
		.click();
	await website.ensureSiteManagerIsOpen();

	// Wait for the saved site to load - this verifies the saved site wasn't overwritten
	// by the ZIP import (which went to a new saved site instead)
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

		// Use a unique temporary slug so the missing-site prompt is expected.
		// Missing saved-site URLs create a new autosaved site by default.
		const uniqueSlug = `missing-modal-test-${Date.now()}`;
		await website.goto(`./?storage=temp&site-slug=${uniqueSlug}`);

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
		await website.goto(`./?storage=temp&site-slug=${uniqueSlug}`);

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
