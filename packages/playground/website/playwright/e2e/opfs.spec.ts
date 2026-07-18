import { test, expect } from '../playground-fixtures.ts';
import type { Blueprint } from '@wp-playground/blueprints';
import type { BrowserContext, Page } from '@playwright/test';
import { encodeZip, collectBytes } from '@php-wasm/stream-compression';
import { getDirectoryNameForSlug } from '../../src/lib/state/opfs/opfs-site-path';

/**
 * Creates a minimal WordPress export ZIP file for testing imports.
 * The ZIP contains just one marker file with the given marker content.
 */
async function createTestWordPressZip(
	markerContent: string,
	markerPath = 'wp-content/index.php'
): Promise<Buffer> {
	const encodedMarker = Buffer.from(markerContent).toString('base64');
	const phpContent = `<?php echo base64_decode('${encodedMarker}');`;
	const file = new File([phpContent], markerPath, {
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

/** Returns the active Playground name kept in the Dock chrome. */
function getPlaygroundTitle(page: Page) {
	return page.locator('[class*="dock-site-name"]');
}

/** Opens the Dock's Store permanently pane from its save-status control. */
async function openStorePermanentlyPane(page: Page) {
	await page
		.getByRole('navigation', { name: 'Playground tools' })
		.getByRole('button', { name: /^(Unsaved|Autosaved)$/ })
		.click();
	const pane = page.locator('section[aria-label="Store permanently pane"]');
	await expect(pane).toBeVisible({ timeout: 10000 });
	return pane;
}

/** Saves the active site through the Dock's Store permanently pane. */
async function saveSiteViaDockPane(
	page: Page,
	options?: {
		customName?: string;
		storageType?: 'opfs' | 'local-fs';
	}
) {
	const { customName, storageType = 'opfs' } = options || {};

	const pane = await openStorePermanentlyPane(page);

	// If a custom name is provided, update it
	if (customName) {
		const nameInput = pane.getByLabel('Playground name');
		await nameInput.fill('');
		await nameInput.type(customName);
	}

	if (storageType === 'opfs') {
		await pane
			.getByRole('radio', { name: /Save in browser storage/ })
			.check();
	} else {
		await pane
			.getByRole('radio', { name: /Save in a local directory/ })
			.check();
	}

	await pane.getByRole('button', { name: 'Save' }).click();

	// Wait for the pane to close.
	// The save operation syncs to OPFS which can take time, so we use a longer timeout.
	await expect(pane).not.toBeVisible({ timeout: 60000 });
}

async function getActivePlaygroundSite(page: Page) {
	return page.evaluate(() =>
		(window as any).playgroundSites
			.list()
			.find((site: any) => site.isActive)
	);
}

async function waitForActivePlaygroundSiteSlug(
	page: Page,
	matchesSlug: (slug: string) => boolean
) {
	await expect
		.poll(
			async () => {
				const slug = (await getActivePlaygroundSite(page))?.slug;
				return typeof slug === 'string' &&
					slug.length > 0 &&
					matchesSlug(slug)
					? slug
					: '';
			},
			{ timeout: 120000 }
		)
		.not.toBe('');

	return await getActivePlaygroundSite(page);
}

async function setActivePlaygroundSite(page: Page, siteSlug: string) {
	await page.evaluate(
		(slug) =>
			(window as any).playgroundSites.setActiveSite(slug, {
				updateUrl: false,
			}),
		siteSlug
	);
}

async function openPlaygroundPath(page: Page, path: string) {
	// goTo() resolves after the nested iframe loads, so no additional test delay is needed.
	await page.evaluate(
		(requestedPath) => (window as any).playground.goTo(requestedPath),
		path
	);
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

	// Store the temporary site from the Dock.
	const firstSiteName = 'Switching Test Site';
	await saveSiteViaDockPane(website.page, { customName: firstSiteName });

	await expect(getPlaygroundTitle(website.page)).not.toContainText(
		'Unsaved Playground',
		{
			// Saving the site takes a while on CI
			timeout: 90000,
		}
	);
	await expect(getPlaygroundTitle(website.page)).toContainText(firstSiteName);

	// Start another saved Playground, then switch back to the first one.
	await website.openDockPane('New Playground');
	await website.page
		.getByRole('button', {
			name: 'Vanilla WordPress - New Playground',
			exact: true,
		})
		.click();
	await website.waitForNestedIframes();
	await website.ensureSiteManagerIsOpen();

	await expect(getPlaygroundTitle(website.page)).not.toContainText(
		firstSiteName
	);
	await expect(
		website.page.getByRole('button', { name: 'Autosaved' })
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

	await website.openPlaygroundsPane();
	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: firstSiteName })
		.click();
	await website.ensureSiteManagerIsOpen();

	await expect(getPlaygroundTitle(website.page)).toContainText(firstSiteName);
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

	// Store the temporary site from the Dock.
	await saveSiteViaDockPane(website.page);

	await expect(getPlaygroundTitle(website.page)).not.toContainText(
		'Unsaved Playground',
		{
			// Saving the site takes a while on CI
			timeout: 90000,
		}
	);

	const storedPlaygroundTitleText = await getPlaygroundTitle(
		website.page
	).textContent();
	await expect(storedPlaygroundTitleText).not.toBeNull();
	await expect(storedPlaygroundTitleText).not.toMatch('Unsaved Playground');

	// Create another Playground, then switch back.
	await website.openDockPane('New Playground');
	await website.page
		.getByRole('button', {
			name: 'Vanilla WordPress - New Playground',
			exact: true,
		})
		.click();
	await website.waitForNestedIframes();

	// Open the Playgrounds pane again to switch back to the stored site.
	await website.openPlaygroundsPane();

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
	await saveSiteViaDockPane(website.page);

	await expect(getPlaygroundTitle(website.page)).not.toContainText(
		'Unsaved Playground',
		{
			timeout: 90000,
		}
	);

	await website.ensureSiteManagerIsOpen();

	// Rename from the Site Settings header.
	await website.page
		.getByRole('button', { name: 'Rename Playground' })
		.click();

	const newName = 'My Renamed Playground';
	const nameInput = website.page.getByRole('textbox', {
		name: 'Rename Playground',
	});
	await nameInput.fill(newName);
	await nameInput.press('Enter');

	await expect(getPlaygroundTitle(website.page)).toContainText(newName);

	await expect(nameInput).not.toBeVisible();

	// Reload and verify the name persists
	await website.page.reload();
	await website.ensureSiteManagerIsOpen();
	await expect(getPlaygroundTitle(website.page)).toContainText(newName);

	// Verify the name is also updated in the Playgrounds pane.
	await website.openPlaygroundsPane();
	await expect(
		website.page.locator('[class*="siteRowName"]', { hasText: newName })
	).toBeVisible();
	await website.closePlaygroundsPane();
});

test('should show the Store permanently pane with the save controls', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto(getTemporaryPlaygroundUrl());
	await website.ensureSiteManagerIsOpen();

	const pane = await openStorePermanentlyPane(website.page);

	// Verify the playground name input exists and has default value
	const nameInput = pane.getByLabel('Playground name');
	await expect(nameInput).toBeVisible();
	await expect(nameInput).toHaveValue(/.+/);

	// Verify storage location radio buttons exist
	await expect(pane.getByText('Storage location')).toBeVisible();
	await expect(pane.getByText('Save in browser storage')).toBeVisible();
	await expect(pane.getByText('Save in a local directory')).toBeVisible();

	// Verify action buttons exist
	await expect(pane.getByRole('button', { name: 'Save' })).toBeVisible();
	await expect(pane.getByRole('button', { name: 'Cancel' })).toBeVisible();

	await pane.getByRole('button', { name: 'Cancel' }).click();
	await expect(pane).not.toBeVisible();
});

test('should close the Store permanently pane without saving', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto(getTemporaryPlaygroundUrl());
	await website.ensureSiteManagerIsOpen();

	const pane = await openStorePermanentlyPane(website.page);

	// Close without saving using Cancel button
	await pane.getByRole('button', { name: 'Cancel' }).click();
	await expect(pane).not.toBeVisible();

	// Verify the site is still temporary
	await expect(getPlaygroundTitle(website.page)).toContainText(
		'Unsaved Playground'
	);

	await openStorePermanentlyPane(website.page);

	// Close using ESC key
	await website.page.keyboard.press('Escape');
	await expect(pane).not.toBeVisible();

	// Verify the site is still temporary
	await expect(getPlaygroundTitle(website.page)).toContainText(
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

	const pane = await openStorePermanentlyPane(website.page);

	const nameInput = pane.getByLabel('Playground name');

	// Verify the input is focused
	await expect(nameInput).toBeFocused();

	await expect
		.poll(() =>
			nameInput.evaluate(
				(input: HTMLInputElement) =>
					input.selectionStart === 0 &&
					input.selectionEnd === input.value.length
			)
		)
		.toBe(true);

	// Type to replace the selected text
	await website.page.keyboard.type('New Name');
	await expect(nameInput).toHaveValue('New Name');

	await pane.getByRole('button', { name: 'Cancel' }).click();
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
	await saveSiteViaDockPane(website.page, { customName });

	// Verify the site was saved with the custom name
	await expect(getPlaygroundTitle(website.page)).toContainText(customName, {
		timeout: 90000,
	});

	// Verify the name also appears in the Playgrounds pane.
	await website.openPlaygroundsPane();
	await expect(
		website.page.locator('[class*="siteRowName"]', { hasText: customName })
	).toBeVisible();
	await website.closePlaygroundsPane();
});

test('should not persist the Store permanently pane through page refresh', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto(getTemporaryPlaygroundUrl());
	await website.ensureSiteManagerIsOpen();

	const pane = await openStorePermanentlyPane(website.page);

	// Dock pane state is not encoded in the URL.
	expect(website.page.url()).not.toContain('modal=save-site');

	// Reload the page
	await website.page.reload();
	await website.waitForPlaygroundShell();

	await expect(pane).toHaveCount(0);
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

	const pane = await openStorePermanentlyPane(website.page);

	// Verify OPFS option is selected by default
	const opfsRadio = pane.getByRole('radio', {
		name: /Save in browser storage/,
	});
	await expect(opfsRadio).toBeChecked();

	await pane.getByRole('button', { name: 'Cancel' }).click();
});

test('should block closing and finish during a ZIP import', async ({
	website,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	await website.goto(getTemporaryPlaygroundUrl());
	await website.openDockPane('New Playground');
	await website.page
		.getByRole('tab', { name: 'Import zip', exact: true })
		.click();

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
	const importingButton = website.page.getByRole('button', {
		name: 'Importing…',
	});
	await expect(importingButton).toBeVisible();
	const saveStatus = website.page.getByRole('button', { name: 'Unsaved' });
	await expect(saveStatus).toBeDisabled();
	await saveStatus.evaluate((button: HTMLButtonElement) => button.click());
	await expect(
		website.page.getByRole('dialog', { name: 'New Playground pane' })
	).toBeVisible();
	await expect(
		website.page.locator('section[aria-label="Store permanently pane"]')
	).toHaveCount(0);
	const newPlaygroundTool = website.page
		.getByRole('navigation', { name: 'Playground tools' })
		.getByRole('button', { name: 'New Playground' });
	await expect(newPlaygroundTool).toBeDisabled();
	await website.page.keyboard.press('Escape');
	await expect(
		website.page.getByRole('dialog', { name: 'New Playground pane' })
	).toBeVisible();
	await expect(importingButton).toBeVisible();
	await importComplete;
	await expect(newPlaygroundTool).toBeEnabled();

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
	await saveSiteViaDockPane(website.page, { customName: savedSiteName });

	// Wait for the site to be saved (title should change from "Temporary Playground")
	await expect(getPlaygroundTitle(website.page)).toContainText(
		savedSiteName,
		{ timeout: 90000 }
	);

	// Open the New pane where ZIP imports start.
	await website.openDockPane('New Playground');
	await website.page
		.getByRole('tab', { name: 'Import zip', exact: true })
		.click();

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
	await expect(getPlaygroundTitle(website.page)).not.toContainText(
		savedSiteName,
		{ timeout: 30000 }
	);
	await expect(getPlaygroundTitle(website.page)).not.toContainText(
		'Unsaved Playground'
	);

	// Now verify the saved site still has the original content.
	// Open the Playgrounds pane and switch to the saved site.
	await website.openPlaygroundsPane();

	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: savedSiteName })
		.click();
	await website.ensureSiteManagerIsOpen();

	// Wait for the saved site to load - this verifies the saved site wasn't overwritten
	// by the ZIP import (which went to a new saved site instead)
	await expect(getPlaygroundTitle(website.page)).toContainText(
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
	await saveSiteViaDockPane(website.page, { customName: savedSiteName });

	await expect(getPlaygroundTitle(website.page)).toContainText(
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
	await expect(getPlaygroundTitle(website.page)).toContainText(savedSiteName);

	// Open the New pane where ZIP imports start.
	await website.openDockPane('New Playground');
	await website.page
		.getByRole('tab', { name: 'Import zip', exact: true })
		.click();

	const importZipButton = website.page.getByRole('button', {
		name: 'Choose a .zip file…',
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
	await expect(getPlaygroundTitle(website.page)).not.toContainText(
		savedSiteName,
		{ timeout: 30000 }
	);
	await expect(getPlaygroundTitle(website.page)).not.toContainText(
		'Unsaved Playground'
	);

	// Verify the saved site is still intact by switching to it
	await website.openPlaygroundsPane();

	await website.page
		.locator('[class*="siteRowContent"]')
		.filter({ hasText: savedSiteName })
		.click();
	await website.ensureSiteManagerIsOpen();

	// Wait for the saved site to load - this verifies the saved site wasn't overwritten
	// by the ZIP import (which went to a new saved site instead)
	await expect(getPlaygroundTitle(website.page)).toContainText(
		savedSiteName,
		{ timeout: 30000 }
	);
});

test('should persist an imported ZIP saved site after switching away and back', async ({
	website,
	wordpress,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	const savedSiteMarker = 'ZIP_IMPORT_PERSISTENCE_SOURCE';
	const blueprint: Blueprint = {
		landingPage: '/saved-site-marker.php',
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/saved-site-marker.php',
				data: `<?php echo '${savedSiteMarker}';`,
			},
		],
	};
	await website.goto(
		getTemporaryPlaygroundUrl(`#${JSON.stringify(blueprint)}`)
	);
	await expect(wordpress.locator('body')).toContainText(savedSiteMarker);

	await website.ensureSiteManagerIsOpen();
	const savedSiteName = 'ZIP Import Persistence Source';
	await saveSiteViaDockPane(website.page, { customName: savedSiteName });
	await expect(getPlaygroundTitle(website.page)).toContainText(
		savedSiteName,
		{ timeout: 90000 }
	);
	const savedSite = await getActivePlaygroundSite(website.page);
	expect(savedSite?.slug).toBeTruthy();
	const savedSiteSlug = savedSite.slug;

	await website.openDockPane('New Playground');
	await website.page
		.getByRole('tab', { name: 'Import zip', exact: true })
		.click();

	const importedMarker = 'ZIP_IMPORT_PERSISTED_MARKER';
	const importedMarkerPath = 'imported-marker.php';
	const zipBuffer = await createTestWordPressZip(
		importedMarker,
		importedMarkerPath
	);
	const dialogs: string[] = [];
	const importSuccessMessage =
		'File imported! This Playground instance has been updated and will refresh shortly.';
	website.page.on('dialog', async (dialog) => {
		dialogs.push(dialog.message());
		await dialog.accept();
	});

	await website.page
		.locator('input[type="file"][accept*=".zip"]')
		.setInputFiles({
			name: 'test-import-persistence.zip',
			mimeType: 'application/zip',
			buffer: zipBuffer,
		});

	await expect
		.poll(() => dialogs, { timeout: 120000 })
		.toEqual([importSuccessMessage]);
	const importedSite = await waitForActivePlaygroundSiteSlug(
		website.page,
		(slug) => slug !== savedSiteSlug
	);
	expect(importedSite?.slug).toBeTruthy();
	const importedSiteSlug = importedSite.slug;
	// Discard the import runtime before requesting the marker. The fresh runtime
	// must load the imported file from persisted OPFS state.
	await website.goto(`./?site-slug=${importedSiteSlug}`);
	await openPlaygroundPath(website.page, `/${importedMarkerPath}`);
	await expect(wordpress.locator('body')).toContainText(importedMarker);

	await setActivePlaygroundSite(website.page, savedSiteSlug);
	await website.waitForNestedIframes();
	await expect(getPlaygroundTitle(website.page)).toContainText(
		savedSiteName,
		{ timeout: 30000 }
	);

	await setActivePlaygroundSite(website.page, importedSiteSlug);
	await website.waitForNestedIframes();
	await openPlaygroundPath(website.page, `/${importedMarkerPath}`);
	await expect(wordpress.locator('body')).toContainText(importedMarker);

	await website.goto(`./?site-slug=${importedSiteSlug}`);
	await openPlaygroundPath(website.page, `/${importedMarkerPath}`);
	await expect(wordpress.locator('body')).toContainText(importedMarker);
	expect(dialogs).toEqual([importSuccessMessage]);
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
